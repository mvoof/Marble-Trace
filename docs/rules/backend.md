# Backend rules

The Rust layers, the generated contract, car badges, input bindings and packaging. Background: `docs/architecture.md` Part I.

## Layers and the contract

Four layers with strict one-way imports:

_Held by: review for the layer imports — Rust has no import lint, and `computations/` staying free of `kerb` and `tauri` is checked by reading; test for the `ts_values!` files and `SLOW_FIELD_KEYS` (both pinned). `bindings.ts` is not pinned: it is regenerated, never edited, and a stale copy shows only in the diff._

| Layer           | Rule                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `model/`        | serde + specta types only. No `kerb` or `tauri`.                                                                                                  |
| `sources/`      | **Only** layer allowed to `use kerb`. Maps `IracingFrame` → `SourceFrame`.                                                                        |
| `computations/` | Pure logic. No kerb, no tauri. One processor per computed frame (`fuel`, `lap_delta`, `pace_car`, `pit_stops`, `proximity`, `driver_entries`, …). |
| `commands/`     | The Tauri command surface, split by what it touches: `settings`, `telemetry`, `track`, `pit`, `companions`, `perf`, `install`.                    |
| `telemetry/`    | Runtime: assembles `TelemetryBundle`, emits `sim://telemetry/bundle`.                                                                             |

Beside the layers sit the runtimes that own their own commands: `chat/`
(Twitch, YouTube), `companions/`, `hotkeys/`, `input/`, `remote/`.

- `specta` auto-generates `src/shared/contracts/generated/bindings.ts` on `npm run tauri dev` — **never edit manually**. Every `tauri:dev`, `perf --build` or `cargo test` regenerates it and the other generated contracts (below) unformatted, so the working tree shows them rewritten wholesale. **Leave them alone**: the `format` hook in `lefthook.yml` runs `oxfmt` on the staged files, so a commit takes them back to the checked-in form and only a real change to the contract remains. Do not format or revert them by hand.
- The whole export lives in `src-tauri/src/bindings.rs`, and each module registers
  its own types in a `register_types` beside them (`model/`, `computations/`,
  `sources/`, `telemetry/`) — a new type is declared and registered in one file.
  Regenerate without launching the app:
  `UPDATE_BINDINGS=1 cargo test --features dev regenerates_the_contract`.
- **Values do not go through specta** — it exports types, and a default or an
  event name is a value the frontend needs as a compile-time literal (widget
  manifests are read at import time, long before anything could `await` a
  command). Those are declared once via the `ts_values!` macro
  (`model/ts_values.rs`) and generated into `src/shared/contracts/generated/backend-constants.ts`,
  `src/shared/contracts/generated/backend-events.ts`, `src/shared/contracts/generated/telemetry-event-bits.ts` (the
  demand mask) and `src/shared/contracts/generated/hotkey-actions.ts` (the action list). All are checked in and pinned by a test, so a Rust constant
  changed without regenerating fails `cargo test`.
- **The envelope and computed frames are camelCase; raw frames carry kerb's
  names.** `TelemetryBundle`, `TelemetrySlowBundle` and `SourceFrame` carry
  `#[serde(rename_all = "camelCase")]`, and so does every frame the project
  produces (`computations/`, the parsed session snapshot). The raw sim frames —
  `carDynamics`, `carInputs`, `carStatus`, `chassis`, `lapTiming`, `carIdx`,
  `carPositions` — keep kerb's snake*case names and the sim's own `-1`/`0`
  markers; that is a decision, not a backlog. A computed frame says "no value"
  with `Option`, never a marker. Check `bindings.ts` for the frame you read. If
  you add a rename, check `SLOW_FIELD_KEYS` in `remote/hub.rs`: it matches field
  names against the \_encoded* bundle, and a stale entry there silently strips
  the slow tiers off every remote screen rather than failing.
- Never use `f32::INFINITY`/`f32::NAN` in payloads — use finite placeholders or `Option<f32>`.
- All imports at top of file; no fully-qualified paths in logic.

## Panics and unsafe

_Held by: clippy (`[lints]` in `src-tauri/Cargo.toml`, `src-tauri/clippy.toml`); review for where the FFI lives._

- **No `unwrap`/`expect`/`panic!` in production code** — `let … else`, `if let`, `?` or a logged fallback. An invariant that cannot fail goes into the type, not an assertion. Tests keep them: a panic is how a test fails.
- **FFI sits behind safe types.** windows-rs marks every Win32 function and COM method `unsafe`, so the calls live in one wrapper per API (`input/dinput_ffi.rs`, `input/com_apartment.rs`, `companions/`) and the logic around them has no `unsafe`. A wrapper holds its invariants by construction — a `Joystick` exists only with its data format set, a buffer's size is a `const` assertion.
- **Every `unsafe {}` wraps one call and carries a `// SAFETY:` line** naming the precondition that holds. `unsafe fn` bodies still need inner `unsafe {}` blocks.
- **Win32 handles are owned by guards**: `windows::core::Owned<T>` for `HANDLE`/`HICON`/`HBITMAP`, a local guard with `Drop` for anything else (`ScreenDc`, `ComApartment`). No hand-written `CloseHandle`/`DeleteObject` on a return path.
- **Nothing unwinds out of an `extern "system"` callback** — it aborts the process. Check the pointers, stop the enumeration on anything unexpected.
- A panic that still happens is logged with its thread name (`logging::install_panic_hook`).

## Car class badges and colors

_Held by: test (a badge longer than `MAX_BADGE_LENGTH`); review (what goes in the map, and when an id is `verified`)._

Two files in `sources/iracing/`: `car_badges.rs` is the **map** — `CarID → badge`,
the only hand-maintained list — and `car_classes.rs` holds the resolution and
the colors. `session_parse.rs` only calls `apply_class_badges()` /
`normalize_class_color()`; nothing on the frontend derives a class name, every
widget reads `carClassShortName` as the backend resolved it.

The sim does not name classes reliably: `CarClassShortName` is **empty in AI and
hosted sessions** (verified on a dump), and in official ones reads "GT3 Class" or
the car name. What it always sends is each driver's `CarID` and `CarClassID`, so
one badge per class is resolved from the cars in it:

| #   | Source               | Notes                                                            |
| --- | -------------------- | ---------------------------------------------------------------- |
| 1   | `car_badges.rs`      | when **every** car of the class is in the map and they all agree |
| 2   | `CarClassShortName`  | the sim's class name, as it is                                   |
| 3   | `CarScreenNameShort` | the car name, when the class holds one model                     |
| 4   | `Class <CarClassID>` | a multi-model class nothing above could name                     |

The map comes ahead of the sim's name, so "GT3 Class" never reaches a badge
column sized for `GT3`. The map is
keyed by **car, not class**: a car keeps its category in whatever class a session
puts it in (the Ferrari 296 GT3 is class 2708 in a multi-make field and 4036 in
its own series), while iRacing mints a class id per series. No other derivation
exists — no token matching on car names, no filler-word stripping; a car the map
does not know shows its own name.

**Adding a car:** one line in `car_badges.rs`. A category car (GT3, GT4, GTP,
LMP2, TCR…) gets the category constant; a single-make car whose name overflows
the badge column gets a short label; anything else needs no entry. Badges are
capped at `MAX_BADGE_LENGTH` (6) by a test. Mark an id `verified` only once it has
been seen in a dump. Colors: `CLASS_COLOR_MAP` corrects known telemetry/in-game
mismatches.

To read real `CarID` values, dump the session YAML with iRacing running
(`kerb::save_session`, or `cargo run --example test` in `kerb/examples`,
which writes `session.yaml`), then:

```bash
grep -o "CarID: [0-9]*\|CarClassID: [0-9]*\|CarScreenName: .*" session.yaml | paste - - - | sort -u
```

## Input bindings

_Held by: test (a settings action with no handler in `settings-actions.ts`); review (the rest)._

Keyboard shortcuts and controller buttons are **app-level**, not per layout,
and **dispatched in Rust** — a key acts on the car with every webview paused.

| Layer                                           | File                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| action list (id, owner, label, default, effect) | `src-tauri/src/model/hotkeys.rs`                                       |
| dispatch, OS registration, drag/interact modes  | `src-tauri/src/hotkeys/`                                               |
| device polling (DirectInput8)                   | `src-tauri/src/input/`                                                 |
| binding wire types (`Binding`, `BindingMap`)    | `bindings.ts`, re-exported by `src/shared/contracts/input-bindings.ts` |
| settings-UI registry (+ visibility actions)     | `src/features/hotkey-bindings/actions.ts`                              |
| persisted map (`actionId -> Binding[]`)         | `src/features/hotkey-bindings/bindings.store.ts`                       |
| settings actions, applied in main               | `src/features/hotkey-bindings/settings-actions.ts`                     |
| main's half: push map + context, apply          | `src/app/sync/hotkey-sync.ts`                                          |

**Adding a bindable action = one entry in `HOTKEY_ACTIONS` + one key under
`bindings.actions` in `main-app.json`.** The entry's `HotkeyEffect` says what
it does, and decides the kind the frontend sees:

- **sim** (`Pit(PitAction)`, `PitAutoMode`) — a command to the telemetry
  thread, resolved there against the frame it holds
  (`computations/pit_actions.rs`). A new pit action is a `PitAction` variant.
- **view** (`View(ViewControl)`, drag, interact) — a control message to the
  overlays and remote screens, or the overlay modes the dispatcher owns. Each
  client picks its instances under the hotkeys itself.
- **settings** — the dispatcher sends the id to main
  (`hotkey://settings-action`) and main applies it: the settings are main's.
  Needs a handler in `settings-actions.ts` — a test fails without one. This is
  the only kind that needs the main window alive.

- `owner` is the widget _type_, or `'app'`. Widget-owned actions only fire when
  that widget is on screen in the live layout — main pushes the set
  (`onScreenWidgetTypes`) with `set_hotkey_context`, and it is checked per
  press. The generated `widget:<type>:toggle-visibility` actions are the only
  ones past the gate; the backend recognises them by their id.
- `press` runs on key down; `hold` (only interact) runs on both edges.
- Main pushes the **effective** map (defaults folded in) with
  `set_hotkey_bindings`; until it does, nothing is registered.
- **Drag and interact mode belong to the dispatcher**: it flips them, runs the
  interact auto-off watchdog and broadcasts `app://overlay-modes`. Every window
  mirrors them (`appSettings.applyOverlayModes`); `setDragMode` /
  `setInteractMode` only ask (`set_drag_mode`, `set_interact_mode`).
- Device ids are DirectInput `guidInstance`, so replug and port changes keep
  bindings. A driver reinstall that regenerates the GUID is re-matched by
  vendor/product (`src-tauri/src/input/identity.rs`) and the stored id rewritten
  once. Two identical devices are never auto-matched.
- Conflicts (one key on two actions) are allowed and only warned about.

## Packaging and the updater

_Held by: test (the install-mismatch check failing on the bump to 0.29.0); review (NSIS only, the stated `installMode`)._

**NSIS only.** `bundle.targets` is `["nsis"]` — the `.msi` was dropped in 0.25.0
and must not come back. The two are separate installers with separate records of
where they installed, and Windows keeps **one uninstall entry per product**: a
second install rewrites that entry and orphans the first copy, which then keeps
running from its own shortcut, invisible to the updater. That is what the entry
is for — `tauri-plugin-updater` passes no directory to the NSIS installer
(`/S|/P /R /UPDATE /ARGS`, no `/D=`), so the install location comes from the
registry and nowhere else.

`latest.json` is generated per release from whatever bundles were built; its
`windows-x86_64` key is the fallback for a client that could not identify its own
bundle type, and it is never hand-edited. A client picks
`windows-x86_64-<installer>` first, from the bundle marker baked into the
executable.

`plugins.updater.windows.installMode` is stated explicitly rather than inherited
from the plugin default.

**Temporary until 0.29.0:** `commands/install.rs` reports at startup that the
running executable is not the registered installation — the `.msi` migration's
user-facing half. A test in that file fails on the version bump that reaches
0.29.0, and its module doc lists every file to delete. Do not extend it; it is
scheduled to go.
