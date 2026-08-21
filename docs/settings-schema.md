# Settings schema and migrations

How `settings.json` is versioned, when a change to it needs a migration, and how
to write one.

## Where settings live

User settings are persisted to `settings.json` in the app config directory
(`%APPDATA%/com.voof.marble-trace` on Windows) through `tauri-plugin-store`. The
shape is `Settings` in `src/store/sync/persistence.ts`.

The file carries a `schemaVersion` at its top level. It is an **integer** and is
deliberately unrelated to the app's semver:

- the app can reach 0.35 with the schema still at 1;
- a schema bump can land in any release;
- comparison is numeric, so never store `"0.21"` there.

A file with no `schemaVersion` is version 0 — anything written before 0.21.

## Load pipeline

```
store.get('settings')
      ▼
runMigrations(blob)          ← store/settings-schema, pure, works on raw JSON
      ▼
hydrateStores(root, blob)    ← store/sync/persistence
      ▼
mergeWithDefaults(...)       ← utils/deep-merge, per widget and for app settings
```

Four things about this order matter:

1. **Migrations see the raw blob**, before anything prunes it. `mergeWithDefaults`
   drops keys that are not in the defaults, so a migration running later would
   find its legacy fields already gone.
2. **`mergeWithDefaults` does more than prune.** On a type mismatch it resets the
   field to its default and logs a `console.warn`. It runs _after_ migrations, so
   a migration that writes a wrong-typed value has its work silently undone. Test
   for it — see below.
3. **It reaches the layout copies too, but only for defaults.**
   `widgets[].userSettings` goes through `restoreWidgets`, and every
   `layouts[].widgets[]` through `restoreLayoutWidgets`, which is the same repair
   plus one rule: a widget the layout never had is forced to `enabled: false`, so
   filling a hole in an old file cannot put a new widget on someone's overlay.
   The app block is merged separately.

   That covers **a missing key**, which is why adding a setting needs no
   migration even though the widget is stored twice. It does **not** cover a key
   that is present and now means something else — merging keeps the value it
   finds. A migration that rewrites values still has to walk both copies itself,
   with the `blob.ts` helpers.

4. **Both windows run the chain**, each on its own parse of the file, but only
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

- **Adding a field with a default.** `mergeWithDefaults` fills it in on the next
  load, in the top-level `widgets[]` and in every layout's copy alike. Add it to
  `DEFAULT_APP_SETTINGS` or to the widget's manifest defaults.
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
  Defaults are filled in for you (point 3 above), but nothing rewrites a value
  that is already there — and it sits in every layout, not just the active one.

## Adding a migration, step by step

1. **Bump `CURRENT_SCHEMA_VERSION`** in `src/store/settings-schema/index.ts`.
2. **Add `migrations/v{n}-{slug}.ts`** exporting a `Migration` with `to: n` and a
   header comment saying what the format looked like before and after.
3. **Append it to `MIGRATIONS`.** Order is the array's order; a test asserts the
   `to` values run from 1 upwards without gaps and end at
   `CURRENT_SCHEMA_VERSION`.
4. **Capture a fixture** (below) and write tests.
5. **Never edit a shipped migration.** Fix a broken one with a new step on top —
   users who already ran the old one will not run it again.

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

**A widget is in the file twice.** Once in the top-level `widgets[]`, and again
inside every entry of `layouts[].widgets[]`. `mergeWithDefaults` runs after the
chain and repairs only the first — it never descends into layouts. A migration
that touches the top-level array and stops there leaves every layout carrying the
old shape, and the failure is quiet: the app starts, the widget looks right, and
the bad copy only surfaces when the user switches layout.

`settings-schema/blob.ts` exists so that forgetting is not possible:

| Helper                                    | Use it for                                  |
| ----------------------------------------- | ------------------------------------------- |
| `mapEveryWidget(blob, fn)`                | any rewrite of the widget list itself       |
| `patchWidgetSettings(blob, id, fn)`       | changing one widget's `userSettings`        |
| `renameWidgetSetting(blob, id, from, to)` | a key that changed name                     |
| `dropWidgetSettings(blob, id, keys)`      | settings that no longer exist               |
| `asObject` / `asArray`                    | guarding a shape read out of an older build |

```ts
const migrate = (blob: SettingsBlob): SettingsBlob =>
  renameWidgetSetting(blob, 'fuel', 'avgWindow', 'averageWindowLaps');
```

All of them are purely structural: they know no widget id, no setting name and
no default, so using them does not breach the rule below about live imports.
`v1-legacy-consolidation` is written on top of `mapEveryWidget` — copy its shape.

Two behaviours are deliberate and worth knowing before you fight them:

- **A widget the file does not contain is never added.** The widget map is filled
  from the shipped defaults afterwards; an entry invented by a migration would
  outrank them.
- **A key that is absent is not written as `undefined`.** `renameWidgetSetting`
  skips a widget with no old value, because `undefined` survives into the merge
  and beats the shipped default — which is the value the user should actually
  get.

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
- the legacy fields are gone — from the app block, from `widgets[]` **and** from
  every `layouts[].widgets[]` (free if you used `blob.ts`, but assert it anyway:
  the assertion is what catches a later rewrite that stops using the helper);
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
