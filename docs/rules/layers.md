# Layers and how a rule is held

The full rules behind the short list in `AGENTS.md`. Background: ADR-0008, `docs/architecture.md`.

## How a rule is held

Every rule section below opens with what keeps its rules true:

- **lint** — `npm run lint` fails (`.oxlintrc.json`);
- **compiler** — `tsc` or `rustc` refuses it;
- **test** — `npm test` or `cargo test` fails;
- **review** — nothing checks it; a reviewer reading the change applies it.

A review rule is not a weaker one: it is the one that takes reading the code to
keep. When a rule moves from review to a tool, its section says so.

## Layers

**Frontend layers** (`src/`) follow Feature-Sliced Design (ADR-0008), strict
one-way imports:

```
app → pages → widgets → features → entities → shared
```

| Layer       | Holds                                                                                                                                                                                                                                     | May import            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `app/`      | what starts a window: `roots/` (the window roots), `sync/` (wires transport to that window's stores), `windows/` (`main`, `overlay`, `remote`, `hud` shells), `store-providers.tsx`                                                       | everything below      |
| `pages/`    | main-window tabs that render widgets: `widgets/` (list, workbench, preview), `layouts/` (the layout editor's canvas), `settings/` (the settings page and its sections, `bindings/` among them)                                            | the four layers below |
| `widgets/`  | **overlay widgets only**, one slice each (`battery/`, `pit-service/`, …), plus the layer's own `registry.ts`, `widget-manifest.ts`, `widget-mount.ts`, `instance-scope/`                                                                  | the three below       |
| `features/` | something the user does: `pit-service`, `hotkey-bindings`, `layout-editor` (model), `widget-settings` (panel kit), `widget-auto-hide`, `telemetry-inspector`, `diagnostics`, `remote-screens`, `companion-apps`, `twitch-auth`, `preview` | `entities`, `shared`  |
| `entities/` | sim data and the app's model: `sim`, `session`, `cars`, `player`, `environment`, `chat`, `sim-perf`, `track`, `flags`, `radar`, `incidents`, `widget`, `layout`, `app-settings`                                                           | `shared`              |
| `shared/`   | no domain: `api/` (Tauri `invoke`/`emit`, the WebSocket), `contracts/` (generated and hand-written types every layer reads), `settings-schema/` (raw-blob migrations), `ui/`, `hooks/`, `lib/`                                            | nothing above         |

- **A slice does not import a sibling slice of its layer** (entities, features,
  widgets, pages). The exceptions are named edges between entities —
  `allowedSiblings` in `.oxlintrc.json`, checked to stay acyclic: cars →
  session; player → cars, session; incidents → cars, session; flags → cars,
  layout, player; radar → app-settings, cars, layout, session; layout → widget;
  sim → app-settings, cars, environment, layout, player, session, sim-perf,
  track, widget. A new edge is one entry there, never an `@x` re-export file
  (that is a barrel).
- **`shared/contracts/` imports nothing but itself.**
- **A file directly in a layer folder** (`widgets/registry.ts`,
  `widgets/widget-manifest.ts`) belongs to no slice and is shared by the layer.
- **Reading upward by glob is not an import.** The catalogue
  (`entities/widget/widget-catalog.ts`) globs `widgets/*/manifest.ts`, the
  panel registry (`features/widget-settings/panel-registry.ts`) globs
  `widgets/*/*SettingsPanel.tsx`; neither is checked, and these two are the
  only places that do it.
- **No `index.ts`.** A slice's public face is whatever file a caller names by
  its direct path; for a widget that is `manifest.ts` and `mount.ts`.
- **Two meanings of "widget", two layers.** The widget _as data_ — manifest
  type, instance record, its settings, the catalogue, the instance-store
  lifecycle — is `entities/widget/`. The widget _as UI_ — components, its own
  store, renderers, settings panel — is `widgets/<name>/`. A compound block of
  the main window FSD would also call a widget lives in `app/` or `pages/`, so
  the word means one thing here.
- **A store several widgets share is one folder**, never split between an
  entity and a feature: it is a feature if it has actions (`features/pit-service/`),
  an entity otherwise (`entities/{radar,flags,incidents,track}/`). One that
  drops to a single consumer moves into that widget's slice.

_Held by: lint — `layers/boundaries`, a JS plugin
(`scripts/lint/layers-plugin.mjs`, wired through `jsPlugins` in
`.oxlintrc.json`) owns direction, siblings and contracts; `no-restricted-imports`
owns the carried rules (Tauri only behind `shared/api`, components off
`shared/api` and `@tauri-apps/*`, the window shells, main-only slices off the
overlay, `features/preview` isolation, migrations). Tests and stories are
exempt: they build a real core._

Path aliases match the layers one-to-one: `@app/*`, `@pages/*`, `@widgets/*`,
`@features/*`, `@entities/*`, `@shared/*`; `@/*` for `styles`, `locales`,
`storybook`.

**Frontend data flow:**

```
sim://telemetry/bundle → app/sync → entity stores → widget stores / observer components
```

Each window builds its own root over one renderer core (see MobX Stores → Window roots), accessed via context hooks — never import as singletons.

**Widget system** — every widget declares itself in `src/widgets/<name>/manifest.ts` (plain data, no React), describes its settings once in `settings-schema.ts` beside it, and mounts itself in `mount.ts` (id → component); `src/entities/widget/widget-catalog.ts` collects the manifests into `WIDGETS`/`WIDGET_BY_ID`/`DEFAULT_WIDGETS`, `src/widgets/registry.ts` collects the mounts, and `src/features/widget-settings/panel-registry.ts` collects the settings panels. All three collect by glob, so a new widget edits no shared file. `WidgetContainer` applies scale (`--wfs`), opacity, and background from user settings. Widgets decomposed into sub-components; every component must be `observer()`.

---
