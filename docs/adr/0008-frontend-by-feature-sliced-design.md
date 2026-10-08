# ADR 0008: The frontend is laid out by Feature-Sliced Design

**Status:** accepted, 2026-10-08
**Context:** the FSD refactor (`refactor/fsd-layout`), spec decisions Р1–Р11,
tickets 01–12. Replaces the frontend layering `utils ← ui → store → platform`
that AGENTS.md described until then.

## Decision

`src/` is laid out in six layers, each importing only the layers below it:

```
app → pages → widgets → features → entities → shared
```

| layer       | holds                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------- |
| `app/`      | window roots, sync, window shells, the store providers                                       |
| `pages/`    | main-window tabs that render widgets (widgets, layouts, settings)                            |
| `widgets/`  | overlay widgets only, one slice each                                                         |
| `features/` | something the user does: pit service, bindings, layout editor model, settings panel kit, …   |
| `entities/` | sim data and the app's model: sim, session, cars, player, track, widget, layout, settings, … |
| `shared/`   | no domain: `api/`, `contracts/`, `settings-schema/`, `ui/`, `hooks/`, `lib/`                 |

Within entities, features, widgets and pages, a slice does not import a sibling
slice. The entity edges that must exist are named one by one and kept acyclic.

The rules below came out of the review of the first draft and are part of the
decision.

1. **Two meanings of "widget", two layers.** The widget as data — manifest
   type, instance record, settings, catalogue, instance-store lifecycle — is
   the entity `entities/widget/`. The widget as UI — components, its own
   store, its panel — is a slice of `widgets/`. FSD's own "widget" (a large
   compound block) is not used for main-window blocks: those live in `app/` or
   `pages/`, so the word means one thing in this project.
2. **A store several widgets share is one folder.** It is not split between an
   entity (state) and a feature (actions) for the sake of layer purity: a
   feature if it has actions (`features/pit-service/`), an entity otherwise
   (`entities/{radar,flags,incidents,track}/`). With one consumer left it moves
   into that widget's slice.
3. **No `index.ts`.** FSD asks for a public API per slice; this project bans
   barrel files and keeps the ban. Imports name a file by its direct path; the
   slice boundary is held by the lint, not by an index. For a widget the public
   face stays `manifest.ts` and `mount.ts`.
4. **Named entity edges, not `@x`.** FSD's cross-import notation is a
   re-export file, i.e. a barrel. The same edge is listed once in
   `allowedSiblings` (`.oxlintrc.json`), and the plugin rejects a cycle.
5. **Reading upward by glob is allowed, nowhere else.** The catalogue
   (`entities/widget/widget-catalog.ts`) globs `widgets/*/manifest.ts`, the
   panel registry (`features/widget-settings/panel-registry.ts`) globs
   `widgets/*/*SettingsPanel.tsx`. `import.meta.glob` is not an import; these
   are the only two.
6. **Hooks per slice.** Each store's context and hook sit beside the store
   (`*-context.ts`, made with `createStoreContext`); `app/store-providers.tsx`
   provides them from a root. Store constructors take a narrow interface of
   what they read instead of `RendererCore`, so nothing below `app/` names the
   core. The roots stay MobX classes, not React providers: sync, hotkeys,
   previews and Storybook need the stores outside React.
7. **A widget's settings are described once, in its slice**
   (`widgets/<name>/settings-schema.ts`, a small own DSL in
   `shared/lib/widget-settings-dsl.ts`). The type, the shipped defaults, the
   Storybook controls, the panel rows and the check on load and on write all
   come from it. The hand-written union of every widget's settings is gone.
   The file format of `settings.json` did not change.
8. **Slices are flat.** FSD's segments (`ui/`, `model/`, `lib/`) are made only
   when one would hold more than one file; today no widget slice has any.

## Why

The old layers were named by the kind of code, not by what it is about.
Everything one subsystem needs was cut across `store/`, `ui/` and `platform/`:
the layout editor was `store/layout/layout-editor.store.ts` plus
`ui/app/main/components/LayoutEditor/`, the hotkeys were `store/hotkeys/` plus
`ui/app/main/components/BindingsSettings/` plus `platform/sync/hotkey-sync.ts`.
Understanding a feature meant assembling it from three trees. `store/` mixed
levels — sim data, the layout model, user actions, shared widget stores —
side by side although they depend on each other one way. And the one shared
settings type (`types/widget-settings.ts`, 1110 lines, imported by ~250 files)
was the most-conflicted file in parallel work: it changed in 57 of 187 commits
over two months, and deleting a widget's folder broke the build.

FSD names layers by meaning and gives each subsystem one folder. The direction
of imports was already one-way; the layout makes it readable from the path.

## What it costs

- **A guarantee moved from the compiler to the lint.** With one core context
  typed `RendererCore`, an overlay reaching a main-only store was a type error.
  With per-slice contexts it compiles and throws "missing provider" at run
  time. The lint now refuses the main-only `*-context` files in `widgets/`,
  `shared/ui`, `shared/hooks` and the overlay, remote and hud shells, and
  `overlay-root.test.ts` still checks the overlay builds none of their stores.
  Accepted by the user for ticket 02.
- **The layer rule is a JS plugin.** `no-restricted-imports` cannot say "any
  slice but your own", and oxlint keeps only the last override that sets a
  rule, so direction, siblings and contracts are one rule, `layers/boundaries`
  (`scripts/lint/layers-plugin.mjs`), through oxlint's JS plugins (alpha at the
  time). The carried rules — Tauri behind `shared/api`, components off it, the
  window shells, preview isolation (ADR-0004), migrations — stay in
  `no-restricted-imports`. Tests and stories are exempt: they build a real
  core.
- **Some stores reached across a would-be boundary** and had to change shape:
  auto-hide was lifted out of `entities/widget` into
  `features/widget-auto-hide/`, `widget-defaults` takes `{ capabilities }`
  instead of the sim store, `layout-resize` moved down into `entities/widget/`.
- **Every path in the docs and the history moved.** `git log --follow` keeps a
  file's history; the docs were rewritten in the same branch.

## Considered and rejected

- **A hot telemetry path** (a separate 60 Hz event and a bus around MobX),
  proposed with the first draft. It is ADR-0006's question again and its
  answer stands: the same JSON, more events, and store writes cost 0.03 MiB/s.
  Revisit only on ADR-0006's own condition.
- **Everything about a widget in `entities/`.** An entity may not import a
  feature (the pit service widget orders a stop) nor a sibling entity (a
  widget reads session, cars and player at once).
- **Window roots as React providers.** The stores are needed outside React.
- **`shared/lib/formatters/`, `constants/`.** `shared/lib` stays one file per
  subject, as `utils/` was.
- **valibot or zod for the settings schema.** Both infer the types as well;
  valibot is twice the size of the own DSL and keeps bounds and options in an
  internal pipe the rows, Storybook and the clamp would have to dig out; zod is
  4–20× larger. Revisit if nested settings grow — that is where a hand-rolled
  validator stops being small.
- **Locale files per slice.** Keys were renamed to the setting keys instead,
  in the shared `locales/<lang>/widgets.json`; a test names every block that
  outlives its widget.
