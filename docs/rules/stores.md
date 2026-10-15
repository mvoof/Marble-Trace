# Stores and settings rules

Window roots, store layers, the client protocol, remote screens, the layout editor and the settings schema. Background: ADR-0003/0005/0007, `docs/settings-schema.md`.

## MobX stores

Each window builds its own root; access via context hooks. **Never import stores as singletons.**

### Window roots

_Held by: compiler (an overlay writing settings — the core holds `LiveWidgetsView`; a wrong store handed to a provider in `store-providers.tsx`); lint (a main-only store's hook imported by `widgets/`, `shared/ui`, `shared/hooks` or the overlay, remote and hud shells — this moved from compiler to lint with the per-slice contexts, ADR-0008); test (`overlay-root.test.ts`: an overlay builds none of the main-only stores); review (stores reached through hooks, never as singletons)._

| Root           | Built by                     | Holds                                                                                                                                                            |
| -------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RendererCore` | every renderer, and previews | entity stores, sim, settings projection (`layouts`, `liveWidgets`, `widgetDefaults`, `appSettings`, `settingsMutations`), units, widget stores, `widgetAutoHide` |
| `OverlayRoot`  | `overlay.tsx`                | core + `AppWindowStores` (`bindings`, `settingsPanelUi`) + `settingsClient`                                                                                      |
| `MainRoot`     | `main.tsx`                   | core + `AppWindowStores` + editor, companion apps, twitch auth, device list, bindings UI, remote devices, fps diagnostics, export, inspector, track rotation     |
| `RemoteRoot`   | `remote.tsx`                 | core, started without Tauri                                                                                                                                      |
| `HudRoot`      | `hud.tsx`                    | `diagnosticsHud` only — no core                                                                                                                                  |

The roots are MobX classes in `app/roots/`, not React providers — sync,
hotkeys, previews and Storybook need the stores outside React.

**Hooks follow the stores, not the roots.** Each store's slice declares its own
context and hook beside it (`entities/player/player-context.ts` →
`PlayerContext`, `usePlayerStore`), made with `createStoreContext`
(`shared/lib/store-context.ts`); a hook read where nothing provides its store
throws, naming the store. `app/store-providers.tsx` provides them from a root:
`CoreProvider` (every core context from one `RendererCore`),
`AppWindowProvider`, `MainProvider` — each a flat typed list. A store's
constructor takes a narrow interface of what it reads, declared beside it
(`type FuelWidgetDeps = { … }`); `RendererCore` satisfies it structurally, so
nothing below `app/` names the core.

- A widget's instance store is handed its dependencies through
  `WidgetHostContext` (`widgets/widget-host-context.ts`); app provides the core.
- A page that renders a preview gets it through `PreviewWorldContext`
  (`features/preview/preview-host-context.ts`, provided by `MainProvider`) —
  `PreviewCore` itself stays in `app/roots/renderer-core.ts`.
- `root-store-context.ts` (`RendererCoreContext`, `useStore`) and
  `main-root-context.ts` (`useMainRoot`) remain for the window shells and
  Storybook only.

The core holds the widget store as `LiveWidgetsView` — reads and snapshot
installs, no settings write — so an overlay's write is a compile error; main
writes through `useMainLiveWidgetsStore()` (`entities/layout/main-live-widgets-context.ts`),
a preview through its `PreviewCore`. `widgets/`, `shared/ui`, `shared/hooks`
and the overlay, remote and hud shells may not import a main-only `*-context`
(`.oxlintrc.json` lists them), and `app/roots/overlay-root.test.ts` asserts an
overlay constructs none of the main-only stores. A store a new window-only
feature needs goes on that window's root, not on the core — and its context
file joins that lint list.

### Layer rules

_Held by: review._

```
backend events (bindings.ts types)
      ▼
entity stores     — thin frame buffers; plain setters, no derived, no timers; expose reset()
      ▼                         ◄── settings stores (entities/app-settings, layout, widget)
widget stores     — presentation: derived getters, UI state, timers
      ▼
components        — observer(); read stores directly
```

1. **entity store** (`entities/sim`, `session`, `cars`, `player`, …) — types from `bindings.ts` only. No hand-written duplicates of backend event shapes.
2. **widget store** — create only when a widget has UI state, timers, or non-trivial derived logic. Simple widgets read entity stores directly.
3. Shared derived used by 2+ widgets → `computed` getter on the entity store, not duplicated.
4. **One-way flow** — widget stores read entities/settings; entity stores know nothing about widgets.
5. **Hooks** = DOM/browser only (`ResizeObserver`, `getBoundingClientRect`, RAF). Everything else belongs in a store.
   A value goes in a store when any of these holds: it is derived from telemetry
   or settings, it runs a timer or a reaction, something besides its component
   reads it (another component, a hotkey, sync, a preview), it must survive a
   remount, or it is worth a unit test. What none of them touches stays in the
   component as `useState`/`useRef`: a DOM measurement (size, path length, the
   canvas element), transient UI state (hover, a local popover), a form draft
   before it is saved.
6. **Each value has exactly one owner.**

### Reactivity rules

_Held by: review._

- Derived values → `computed` getters in store, never `useMemo` in components.
- `updateUserSettings` mutates fields in place (`Object.assign`) — never replaces the `userSettings` object reference.
- Widget layout changes (column toggles, orientation swaps) handled via `resolveLayoutChange` in the widget's `manifest.ts`, not as `if/else` in the store.
- A reaction that must follow every settings edit watches `changeToken` (`SettingsMutationLog`), never a `JSON.stringify` of the settings tree.

### Main owns the settings; every other window is a client

_Held by: compiler (a `RemoteControlKind` with no case in `applyControl`); test (`client-sync.test.ts`, one case per kind for both transports; `remote/server.rs`, a settings command from a browser refused); review (state in the snapshot, events in signals)._

Each Tauri window has its own JS context and its own MobX stores. **Main is the
only window that holds and writes the settings** (ADR-0007); an overlay and a
remote screen are **clients** of one protocol. The why, the acknowledgement rules
and the full payloads: `docs/adr/0007-main-owns-settings.md`.

| direction                | what                                                                                  | where                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| main → client            | **snapshot**: the client's own screen, its widgets, the app values they read          | `client-snapshot.ts`, `client-publish.ts`, `remote-publish.ts`           |
| main → client            | **signal**: `{ type: RemoteControlKind, data }` — a hotkey's scroll, a toast, a reset | `client://control` / the socket; `broadcastControl`, `send_view_control` |
| overlay → main           | **command**: `setGeometry`, `setEnabled`, `enableTypeOnMonitor`, `patchSettings`      | `settings-client.store.ts` → `client-publish.ts`                         |
| client, either transport | installs snapshots, runs signals                                                      | `client-sync.ts` (overlay: `overlay-sync.ts`, browser: `remote-sync.ts`) |

- **State goes in the snapshot, events go in signals.** A value a client must
  still show after a reload is a field of `ClientSnapshot`
  (`src/shared/contracts/client-protocol.ts`), added in `clientSnapshotFor` and in
  `snapshotAppInputs`, which republishes on it. A one-off happening is a
  `RemoteControlKind` variant in `src-tauri/src/model/events.rs`; its case in
  `applyControl` is enforced by the compiler, and `client-sync.test.ts` gets
  one case for both transports. `reaches_remote_screens()` keeps a kind on the
  driver's screens; `Replayed::replayed()` replays one to a socket that
  connects later.
- **An overlay changes a setting only by command**, through `root.settingsClient`
  (the popup's panels reach it through `WidgetEditorProvider`). It draws its own
  edit at once as an override, until main has handled the command. Main runs a
  command through the editor's own methods inside `applyClientCommand` — the
  live layout, no undo step.
- **A remote screen never sends a command**; the hub refuses one.
- Main's own edits — the editor, the settings pages — write its stores
  directly, and `changeToken` (`SettingsMutationLog`) is what saves and
  republishes them.
- The drag and interact modes are the backend's: it broadcasts
  `app://overlay-modes` to every window.

### Remote screens

_Held by: review (`remote.html` and `client-sync.ts` free of `@tauri-apps/*`)._

A remote screen is a layout monitor rendered by a browser on the LAN. Same widget
components, same coordinates, the client protocol above over a WebSocket. Full
picture: `docs/architecture.md` → Cross-window synchronization.

| Layer            | File                                                     |
| ---------------- | -------------------------------------------------------- |
| server / fan-out | `src-tauri/src/remote/{server,hub,mirror,pages}.rs`      |
| main-window half | `app/sync/remote-publish.ts`                             |
| browser half     | `app/sync/remote-sync.ts` → `client-sync.ts`             |
| page entry       | `remote.html` → `src/remote.tsx` → `app/windows/remote/` |

- **Read-only.** A device reports only its viewport, applied once to fit a newly
  created screen.
- One kind of screen, whoever opens it: a tablet and an OBS browser source read
  the same page, and `background` (any CSS color, or `'transparent'`) is the
  only difference. A transparent screen paints no ground of its own and shows
  no status card (`RemoteStatusOverlay`). `fittedToDevice` marks a screen as
  already matched to a device, so only the first connection resizes it.
- `remote.html` is a separate Vite entry and stays free of `@tauri-apps/*` —
  so does `client-sync.ts`, which it imports.

### Layout editor

_Held by: lint (`src/features/preview/**` reaching a root's context, `@app`, `@pages`, `@shared/api` or Tauri); review (the rest)._

`pages/layouts/` is a WYSIWYG view of the overlay inside the
main window; its model — the editor store, gestures, snapping — is the feature
`features/layout-editor/`, below the widgets it cannot render.

- Two layouts, not one: `editingLayoutId` is what the editor works on,
  `liveLayoutId` what the overlay renders. They are the same value until the
  editor opens, which pins the live one — so the session auto-switch keeps
  moving the driver's screen while the user edits another layout, and closing
  the editor hands the live layout back as the edited one. `previewMode`
  (`layoutEditor`) is derived from the two, not stored.
- Geometry is read from and written to the **main** `LiveWidgetsStore`; widget
  _content_ renders against an isolated `PreviewCore` seeded from
  `features/preview/scenarios.ts`, mirrored on `changeToken`.
- The preview store must never persist anything — stores that own files take a flag
  from `skipInit` (`TrackMapWidgetStore({ persists })`).
- The preview store is isolated, and `no-restricted-imports` over
  `src/features/preview/**` keeps it that way: a scenario or mock builder writes only
  into the `PreviewCore` handed to it, so the root contexts (`*-root-context`),
  `@app/**`, `@pages/**`, `@shared/api/**`, `@shared/settings-schema/**` and
  `@tauri-apps/**` are refused there (ADR-0004 rule 1).
- The editor raises `dragMode` on the preview store, so in-place widget controls
  behave as they do on the overlay. Prefer that flag over an editor-specific branch.
- State an in-place control changes outside the preview store is bridged explicitly
  in `LayoutCanvas` (see `useTrackRotationBridge`), in both directions.
- Widget → monitor is the widget's `monitor` field, never its position: a drag
  is clamped to the widget's own monitor (`updatePosition`), and only
  `moveWidgetToMonitor` hands it to another one. A remote screen is just a
  monitor with `kind: 'remote'`.

---

## Settings schema

_Held by: lint (a migration importing live types, defaults or registries); review (one schema version per release — prove it with `git tag --contains`; storing only overrides)._

`settings.json` carries an integer `schemaVersion` at its top level, unrelated to
the app's semver. Format changes go through the chain in
`src/shared/settings-schema/`, which runs on the **raw blob** between reading the
file and hydrating the stores.

- **One schema version per release.** A version is bumped only once the current
  one has actually reached users — that is, only when the newest step is already
  contained in a release tag (`git tag --contains <commit>`). Everything landed
  after the last tag is one settings version: while the newest step is still
  unreleased, a new format change **joins that step** instead of adding another
  one. Migrating a file through a version no build ever wrote is history nobody
  has, and it strands the settings of anyone running a dev build.
- A migration is a **pure function** and must **never import live types, defaults
  or registries** — freeze what it needs as a literal, or a step written today
  rewrites history by next year's rules.
- **Each monitor owns its widgets.** On disk (v6) they live in
  `layouts[].monitors[].widgets[]`, in that monitor's own coordinates, and
  nowhere else; `widgetTemplates` beside the layouts is only the catalogue the
  Widgets page edits and a new instance starts from. In memory a layout keeps
  one flat `widgets[]` in desktop-wide coordinates, each record naming its
  monitor in `monitor` — `app/sync/settings-file.ts` is the codec between
  the two and the only place that knows the file's shape.
  `LiveWidgetsStore.widgets` is a projection of the active layout's own
  objects, so an edit lands in the record itself and there is nothing to
  commit. A layout with no monitors is not an owner and falls back to a
  detached map.
- **A widget stores only what differs from its manifest.** `settings` holds the
  overridden values, nothing the manifest already says (label, flags, a design
  size it gives) is written, and reading back merges the overrides over the
  shipped defaults — so **a new setting with a default needs no migration**,
  and a changed default reaches every widget that never overrode it. Rewriting
  a value that is already there is still the chain's job. Walk a v6 blob with
  the `*Stored*` helpers in `settings-schema/blob.ts`
  (`mapEveryStoredWidget`, `patchStoredWidgetSettings`,
  `renameStoredWidgetSetting`, `dropStoredWidgetSettings`) rather than by hand;
  they visit every instance on every monitor and the template, and they are
  purely structural so they do not breach the no-live-imports rule. The older
  helpers walk the pre-v6 shape and find nothing in a current file.
- A file this build cannot migrate locks settings against every write instead of
  being repaired or deleted.

Most changes need no migration at all. Full guide: `docs/settings-schema.md`.
