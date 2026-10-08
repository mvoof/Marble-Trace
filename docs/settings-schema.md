# Settings schema and migrations

How `settings.json` is versioned, when a change to it needs a migration, and how
to write one.

## Where settings live

User settings are persisted to `settings.json` in the app config directory
(`%APPDATA%/com.voof.marble-trace` on Windows) through `tauri-plugin-store`. The
shape is `Settings` in `src/app/sync/persistence.ts`.

The file carries a `schemaVersion` at its top level. It is an **integer** and is
deliberately unrelated to the app's semver:

- the app can reach 0.35 with the schema still at 1;
- a schema bump can land in any release;
- comparison is numeric, so never store `"0.21"` there.

A file with no `schemaVersion` is version 0 — anything written before 0.21.

### Who owns the widgets

Since v6, **each monitor of a layout owns its widgets**:
`layouts[].monitors[].widgets[]`. A widget is stored in that monitor's own
coordinates, with its geometry in `frame`, its switch in `enabled`, and in
`settings` **only the values that differ from its manifest**. Nothing the
manifest already says — label, description, flags, a design size it gives — is
written at all.

```json
{
  "id": "track-map-2",
  "type": "track-map",
  "enabled": true,
  "frame": { "x": 1500, "y": 40, "width": 360, "height": 360, "z": 4 },
  "settings": { "showSectors": false }
}
```

In memory the shape is different: a layout keeps one flat `widgets[]` in
desktop-wide coordinates, each record carrying every setting resolved and naming
its monitor in `monitor`. `app/sync/settings-file.ts` converts between the
two, and is the only module that knows the file's shape. The active layout
**owns** its records outright: the store's live widget map is a projection of
that layout's own objects, so an edit in the overlay or the editor lands in the
layout record itself — there is no second copy to commit, debounce or lose.

`widgetTemplates` beside the layouts, keyed by widget type, is only the catalogue
the Widgets page edits — what a new instance starts from, with a size and no
position — never what is on screen.

Before v6 a layout held one flat `widgets[]` in desktop-wide coordinates, and a
widget belonged to whichever monitor contained its centre; the catalogue was
`defaultWidgets[]`. Before v3 the file also carried a top-level `widgets[]`.

## Load pipeline

```
store.get('settings')
      ▼
runMigrations(blob)          ← shared/settings-schema, pure, works on raw JSON
      ▼
hydrateStores(root, blob)    ← app/sync/persistence
      ▼
decodeLayout / decodeTemplates ← app/sync/settings-file
      ▼
checkedSettings(type, …)     ← entities/widget/widget-catalog, each widget's overrides against its schema
      ▼
mergeWithDefaults(...)       ← shared/lib/deep-merge, per widget and for app settings
```

Five things about this order matter:

1. **Migrations see the raw blob**, before anything prunes it. `mergeWithDefaults`
   drops keys that are not in the defaults, so a migration running later would
   find its legacy fields already gone.
2. **`mergeWithDefaults` does more than prune.** On a type mismatch it resets the
   field to its default and logs a `console.warn`. It runs _after_ migrations, so
   a migration that writes a wrong-typed value has its work silently undone. Test
   for it — see below.
3. **A widget's settings are its overrides merged over the manifest.**
   `decodeWidget` and `decodeTemplates` merge every stored `settings` over the
   shipped defaults, so a key the file does not hold is simply the default. A
   widget type the layout holds no instance of is added by `setWidgets` when the
   layout is installed — switched **off**, on the first display — so a new
   widget never appears on someone's overlay by itself. The app block is merged
   separately.

   That covers **a missing key**, which is why adding a setting needs no
   migration, and why a changed default reaches every widget that never
   overrode it. It does **not** cover a key that is present and now means
   something else — merging keeps the value it finds. A migration that rewrites
   values still has to walk every instance itself, with the `blob.ts` helpers.

4. **Each widget's overrides pass its own schema** before they are merged
   (`checkedSettings`, from the slice's `settings-schema.ts`, ADR-0008): a value
   of the wrong type or outside a choice falls back to the shipped one, a number
   out of range is clamped. The same check runs on every write
   (`updateUserSettings`). Like `mergeWithDefaults`, it runs after migrations —
   a migration writing a value the schema refuses has its work undone.

5. **Both windows run the chain**, each on its own parse of the file, but only
   the main window writes. That is why a migration must be pure — a side effect
   would happen twice.

## Locked settings

When `runMigrations` cannot bring the file to the current schema, the file is
**left alone**, not repaired: it was written by a newer build
(`from-the-future`), predates the chain (`too-old`), or is not a settings object
(`corrupt`).

`appSettings.settingsLocked` then suppresses every write. Both `initMainSync` and
`initOverlaySync` return early — no hydration, no default layout, no save
reactions — and `OverlayCanvas` renders nothing, because the widget map still
holds shipped defaults and painting them looks exactly like the user losing their
config. The main window shows `SettingsLockBanner`.

The only write left is `resetSettings()`, which goes straight to the file and
bypasses the gate on purpose: it is the only way out. It **deletes** the file
through the `delete_settings_file` backend command rather than clearing the
store — `tauri-plugin-store`'s `clear()` + `save()` leaves a valid but empty
`{}` behind, which the next start reads as a file that is present and holds no
settings: the exact signature of a corrupt one, so the reset would lock the app
again instead of freeing it.

Before the first save at a new version, the old file is copied to
`settings.v{n}.bak` by the `backup_settings_file` backend command —
`tauri-plugin-store` can only touch the live file.

## When you do NOT need a migration

- **Adding a field with a default.** A widget stores only its overrides, so the
  new key is read from the manifest everywhere — every template and every
  instance on every monitor. Add it to `DEFAULT_APP_SETTINGS` or to the widget's
  manifest defaults.
- **Changing a widget's default or its design size.** The file holds neither
  unless the user changed it, so the new value reaches everyone who did not.
- **Removing a field.** It is pruned from disk on the next save.
- **Renaming a field whose value the user can trivially re-enter.** They set it
  again once; a migration is not worth its permanent cost.
- **Adding an action with a `defaultBinding`.** Bindings are stored as overrides
  only, so an action absent from the file takes the registry default — it reaches
  every existing user with no migration at all.
- **Adding an optional top-level block.** `sessionLayouts` was added this way: it
  is `?`-typed, absent in older files, and every reader handles absent.

## When you DO

- A field **changes meaning or unit** — the old value is still readable and now
  means something wrong. This is the dangerous one: nothing crashes.
- A value **moves** between blocks, or between a widget and the app.
- A rename whose value is **expensive for the user to recreate**: wheel bindings,
  calibration, a hand-drawn layout.
- Any **shape change inside a persisted array**, since `mergeWithDefaults` will
  not reconcile array elements for you.
- **A value inside `layouts[]` that changes meaning, moves or is renamed.**
  Defaults are filled in for you (point 3 above), and restoration keeps a value
  it finds only when it is still a **known key of the right type**: a key absent
  from the defaults is pruned, and one whose type no longer matches is reset to
  the default with a `console.warn`. What it never does is reinterpret a value
  that is still valid and now means something else — that is the migration's job,
  in every layout's copy, not just the active one's.

## Adding a migration, step by step

1. **Bump `CURRENT_SCHEMA_VERSION`** in `src/shared/settings-schema/index.ts`
   — but only if the current version has already shipped. See
   [One version per release](#one-version-per-release).
2. **Add `migrations/v{n}-{slug}.ts`** exporting a `Migration` with `to: n` and a
   header comment saying what the format looked like before and after.
3. **Append it to `MIGRATIONS`.** Order is the array's order; a test asserts the
   `to` values run from 1 upwards without gaps and end at
   `CURRENT_SCHEMA_VERSION`.
4. **Capture a fixture** (below) and write tests.
5. **Never edit a shipped migration.** Fix a broken one with a new step on top —
   users who already ran the old one will not run it again.

### One version per release

A version is bumped **once**, and only after the current one has actually reached
users — that is, only when the newest step is already contained in a release tag
(`git tag --contains <commit>`). While the newest step is still unreleased, a new
format change **joins that step** rather than adding another one on top: v3
carries four unrelated edits for exactly this reason.

Migrating a file through a version no build ever wrote is history nobody has, and
it strands the settings of everyone running a dev build off `main`.

### Capturing a fixture

Take a real `settings.json` written by the previous release and trim it to what
the test needs — keep the app block and one layout intact, drop the rest of the
widgets. `v0-real-capture.json` was made this way.

**Sanitise before committing.** These fixtures go into a public repository:

- `streamChatTwitchClientId`, `streamChatTwitchLogin`, `streamChatYoutubeTarget`
  and anything else account-shaped;
- `inputDevices[].id` — DirectInput GUIDs identify the user's hardware;
- monitor names, if they are not the generic `DISPLAY1` form;
- `layouts[].backgroundImages` — legacy values can be multi-megabyte `data:`
  URLs.

If a future migration touches a secret, strip it **before** the backup is
written, or the plaintext lives on in `settings.v{n}.bak`.

### Walking the blob — use `blob.ts`

**A widget is in the file once per instance, plus once more.** Every monitor of
every layout carries its own instances in `layouts[].monitors[].widgets[]`, and
`widgetTemplates[type]` carries what a new instance starts from. Reading back
fills in **missing** keys from the shipped defaults, but a value the file already
holds is left exactly as found, in every instance. So a migration that rewrites
values and touches one array leaves every other instance carrying the old ones,
and the failure is quiet: the app starts, the widget looks right, and the bad
instance only surfaces when the user switches layout or looks at another screen.

`settings-schema/blob.ts` exists so that forgetting is not possible:

| Helper                                            | Use it for                                  |
| ------------------------------------------------- | ------------------------------------------- |
| `mapEveryStoredWidget(blob, fn)`                  | any rewrite of a monitor's widget list      |
| `patchStoredWidgetSettings(blob, type, fn)`       | changing one widget's `settings`            |
| `renameStoredWidgetSetting(blob, type, from, to)` | a key that changed name                     |
| `dropStoredWidgetSettings(blob, type, keys)`      | settings that no longer exist               |
| `removeStoredWidgets(blob, types)`                | a widget removed from the build             |
| `asObject` / `asArray`                            | guarding a shape read out of an older build |

```ts
const migrate = (blob: SettingsBlob): SettingsBlob =>
  renameStoredWidgetSetting(blob, 'fuel', 'avgWindow', 'averageWindowLaps');
```

A widget is addressed by its **type**, and the patch reaches the template too.
A patch sees **only the overrides**: a key that is absent is on the shipped
default, and should usually stay absent — writing a value pins it for good.

The helpers without `Stored` in their name (`mapEveryWidget`,
`patchWidgetSettings`, …) walk the shape before v6 and find nothing in a current
file. They stay for the steps written before it.

All of them are purely structural: they know no widget id, no setting name and
no default, so using them does not breach the rule below about live imports.

Two behaviours are deliberate and worth knowing before you fight them:

- **A widget the file does not contain is never added.** `setWidgets` adds a
  switched-off instance of every widget a layout lacks; an entry invented by a
  migration would land on someone's screen.
- **A key that is absent is not written as `undefined`.** The rename helpers skip
  an instance with no old value, because that instance is on the shipped
  default — which is the value the user should actually get.

### Rules for the migration itself

- **Walk the blob with `blob.ts`,** never by hand — see above.
- **Never import live types, defaults or registries.** Freeze whatever you need
  as a literal in the migration file. A step that reads today's `ACTIONS` starts
  rewriting history by next year's rules. This is why the v1 hotkey tables are
  copied out rather than imported.
- **Pure function of the blob.** No stores, no filesystem, no network. The runner
  clones the blob once up front so steps may mutate their own copy freely.
- **Idempotent.** Running the chain over its own output must change nothing.
- **Never throw.** Every field a step reads comes out of a build older than this
  one and may have been hand-edited: guard the shape rather than trusting the
  legacy interface. `runMigrations` is wrapped in a `try` and a throw locks the
  whole file, so a single missing `resolution` would cost the user every setting
  they have. Prefer a defensible fallback — v1 gives a monitor with no
  resolution zero bounds and keeps its widgets.
- **No I/O**, which is why the `data:` URL background fallback in
  `layout-background.ts` stays a permanent runtime fallback instead of becoming a
  migration — converting those values needs to write files.
- **Dropping a value is a legitimate option.** v1 does not carry the old
  per-layout hotkeys over at all. They meant "while this layout is active" and
  would now mean "always", every layout held a different copy with no honest way
  to pick a winner, and one accelerator per action does not map onto a model that
  takes any number of keys and device buttons. Translating a value whose meaning
  changed is worse than asking for it again — but say so in the changelog.

## Testing

Runner tests live in `settings-schema/index.test.ts` and drive `runMigrations`
with a synthetic `SchemaConfig`, which is also how `too-old` is reachable at all.
They cover the chain invariants, all five statuses, non-mutation of the input and
idempotency.

Each migration gets its own test next to it, from fixtures. Mandatory cases:

- the values it is meant to lift end up where they belong;
- the legacy fields are gone — from the app block, from `widgetTemplates`
  **and** from every instance on every monitor (free if you used `blob.ts`, but
  assert it anyway: the assertion is what catches a later rewrite that stops
  using the helper);
- nothing the step writes is a type `mergeWithDefaults` would reject — it runs
  _after_ the chain and silently resets a wrong-typed field to its default, so a
  migration can otherwise appear to work and do nothing. `v1` covers this in
  "writes nothing mergeWithDefaults would reject";
- everything it does not touch is untouched;
- degenerate files do not throw: no `layouts` key, empty `layouts`, an
  `activeLayoutId` pointing at a layout that no longer exists;
- running it twice changes nothing.

## Retention

`OLDEST_SUPPORTED_VERSION` in `settings-schema/index.ts` is the floor. Files
below it get the `too-old` status and are left alone rather than migrated.

It is currently 0 and nothing has ever been dropped, so `too-old` is unreachable
in production. When a step is eventually deleted, raise the floor in the same
commit — an invariant test fails if the chain length and the floor disagree.
