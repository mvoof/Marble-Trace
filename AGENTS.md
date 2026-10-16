# AGENTS.md

Marble Trace: an iRacing overlay. Tauri 2 + Rust backend (`kerb` for the sim),
React 19 + MobX + SCSS Modules frontend, Ant Design in the main window. Two
kinds of window: `main` (settings) and one transparent `overlay-<monitor>` per
monitor; browsers on the LAN render remote screens.

## Commands

```bash
npm run tauri:dev          # start app in dev mode (also regenerates bindings.ts)
npm run tauri:build:dev    # dev build (no signing)
npm run tauri:build:release

npm test                   # vitest run (also runs on commit via lefthook)
npm run typecheck          # tsc --noEmit, app and vite config
npm run lint               # oxlint --type-aware
npm run lint:fix
npm run format             # oxfmt write
npm run storybook          # isolated widget stories on :6006

cd src-tauri && cargo fmt
cd src-tauri && cargo clippy --all-targets   # --all-targets or test modules go unlinted
RUST_LOG=marble_trace_lib=debug npm run tauri:dev   # verbose backend logs
MARBLE_TRACE_RECORD=<dir> npm run tauri:dev         # record live sessions as tapes (dev feature)
MARBLE_TRACE_REPLAY=<tape> npm run tauri:dev        # play a tape instead of the sim (dev feature)
npm run perf:build                                     # the release binary perf and perf:game measure
npm run perf:game -- run --name <n> --layout <layout>  # PresentMon capture of what the overlay costs the game
UPDATE_BINDINGS=1 cargo test --features dev regenerates_the_contract  # regenerate contracts without the app
```

Environment variables: `CONTRIBUTING.md` → Environment variables.

## Workflow

- Object when a proposed solution seems wrong: give arguments, wait for confirmation.
- Work on a branch. Commit when the work is done and the hooks pass, Conventional
  Commits style. **Pushing is the user's call, every time** — a new branch too.
- Read external library docs through `context7`.
- Check UI in the real app: Tauri MCP Bridge, `driver_session` (start, port 9223)
  with `tauri:dev` running, then `webview_screenshot` / `webview_find_element` /
  `webview_interact`. Storybook for isolated widgets. Never a plain browser.
- Issues and specs: `.scratch/<feature>/` (`docs/agents/issue-tracker.md`).
  Terms: `CONTEXT.md`; decisions: `docs/adr/`.

## Read before you touch

The rules live in `docs/rules/`; each section opens with what holds it (lint,
compiler, test, or review). Read the file for the area before editing it.

| touching                                                                     | read                                                                 |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| imports between layers or slices, a new file's place                         | `docs/rules/layers.md`, `docs/rules/widgets.md` → Where a file lives |
| `src-tauri/`: layers, contract, car badges, hotkeys, packaging               | `docs/rules/backend.md`                                              |
| the bundle: rates, gated fields, rounding, slow slice, inspector, pit orders | `docs/rules/telemetry.md`                                            |
| stores, window roots, main↔overlay/remote sync, layout editor, settings file | `docs/rules/stores.md`, `docs/settings-schema.md`                    |
| any widget: system, instances, appearance, panel, story, checklist           | `docs/rules/widgets.md`; building one: `docs/widget-authoring.md`    |
| a component reading 60 Hz data                                               | `docs/rendering.md`                                                  |
| code style, SCSS, tokens, `ws()`, live numbers                               | `docs/rules/frontend-style.md`, `docs/widget-toolbox.md`             |
| why something is built this way                                              | `docs/architecture.md`, `docs/adr/`                                  |

## Rules that apply everywhere

- **Layers, one way.** Backend `model/ → sources/ → computations/ → telemetry/`;
  `kerb` only in `sources/`, `computations/` free of kerb and tauri. Frontend
  `app → pages → widgets → features → entities → shared`; a slice never imports
  a sibling slice (named exceptions: `allowedSiblings` in `.oxlintrc.json`).
  Direct file paths; no `index.ts`, no barrels.
- **Generated contracts are untouched.** Everything in
  `src/shared/contracts/generated/` (specta's `bindings.ts` and the
  `ts_values!` outputs) is regenerated, never edited, never formatted by
  hand — the commit hook formats them.
- **Stores through context hooks**, never as singletons. Business logic in MobX
  stores; components only read stores, never `@tauri-apps/*` or `@shared/api/*`.
- **Main owns the settings.** Overlays change a setting only by command; remote
  screens are read-only (ADR-0007).
- **Every component is `observer()`.** Hot fields (`carDynamics`, `carInputs`,
  `carPositions`, `lapDelta`, `driverEntries`, `relative`, `proximity`,
  `fieldEntries`, `relativeEntries`) are read only inside `useReactiveDomWrite` /
  `useReactiveCanvasLoop` (`docs/rendering.md`).
- **One overlay clock.** Publish only on it; nothing animates between bundles —
  state-change transitions only, blinking through `useBlink` (ADR-0009).
- **Gated telemetry is declared** in the widget's `manifest.ts`
  (`telemetryEvents`) for every gated field it reads.
- **A widget is its slice**: `settings-schema.ts`, `manifest.ts` (plain data,
  never imports its component), `mount.ts`, `*SettingsPanel.tsx` — all collected
  by glob, no shared list to edit. Read `widget.type`, never `widget.id`.
- **Settings format changes**: confirm with the user first; one schema version
  per release (`git tag --contains`); migrations are pure, with frozen literals.
- **Code style**: named arrow functions, descriptive names (no 1–3 char names),
  named constants, block `if/else` with blank lines around and before `return`,
  comments only where the code cannot speak. `lucide-react` icons, semantic
  colour tokens, `fs()`/`sp()`/`radius()` sizing, `FixedDigits` for live numbers.
- **Payloads are finite**: `Option`, never `f32::INFINITY`/`NAN`.
