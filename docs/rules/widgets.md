# Widget rules

What a reviewer applies to widget code. To build one, follow `docs/widget-authoring.md` (or the `new-widget` skill) first.

## The widget system

_Held by: test (every manifest has a mount and a schema whose defaults pass their own check, no mount or panel claims a widget the catalog does not ship, the catalog is alphabetical, no locale block outlives its widget, no catalog description runs past 80 characters — `widget-catalog.test.ts`, `registry.test.ts`, `panel-registry.test.ts`, `widget-locales.test.ts`); review (a manifest never importing its component, panel rows sitting directly after their parent)._

Each widget is one slice, `src/widgets/<name>/` (kebab-case; components inside
stay PascalCase), and ships three files of its own that nothing lists by hand:

| file                 | holds                                                                                                                                                                                                                 | read by                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `settings-schema.ts` | every setting of the widget, once: `defineSettings('<locale block>', { … })` with `bool` / `num` / `choice` / `color` / `numRecord` / `nullable`; exports `<NAME>_SETTINGS` and its type `SettingsOf<typeof X.shape>` | the manifest, the panel, Storybook                                                            |
| `manifest.ts`        | id, label, design size, `userSettings` (spreading the schema's `defaults`), `settingsSchema`, optional `resolveLayoutChange`, `telemetryEvents`                                                                       | `src/entities/widget/widget-catalog.ts` (glob) → `WIDGETS`, `WIDGET_BY_ID`, `DEFAULT_WIDGETS` |
| `mount.ts`           | `{ id, component }`, optional per-instance `store` factory and `sharedStores`                                                                                                                                         | `src/widgets/registry.ts` (glob) → `WIDGET_COMPONENTS`                                        |

**A setting is described once, in the slice's schema** (ADR-0008). From it come
the widget's settings type, the shipped defaults, the Storybook controls
(`selectOptions`), the panel rows, and the check every setting passes on load
and on write — `checkedSettings(type, settings)` in `widget-catalog.ts`, called
by the file codec and both `updateUserSettings`: a wrong type or an unknown
member falls back to the shipped value, an out-of-range number is clamped. The
DSL is `shared/lib/widget-settings-dsl.ts`; a choice several widgets share
(`QUALIFYING_VISIBILITY`, `ROW_PADDING`, `LIC_BADGE_STYLE`, …) is a constant in
`shared/contracts/widget-choices.ts`, and a schema two widgets share sits with
their shared store (`entities/radar/radar.settings-schema.ts`,
`entities/flags/flag-display.settings-schema.ts`). There is no union of every
widget's settings: `WidgetUserSettings` is `BaseUserSettings &
Record<string, unknown>`, and code below `widgets/` that reads one widget's
settings declares the narrow interface it needs beside itself. Every setting
has a default, so none is optional and no read needs a `?? fallback`.

A manifest is **plain data and never imports its own component** — that is why
the mount is a second file rather than a field. Three reasons, in order of
weight: the manifest is read by **`entities/widget`** at import time, and one that
imported React would drag every widget's tree into the settings and into the
store's own tests; the same data is needed by things that never render
(migrations, `DEFAULT_WIDGETS`, node-side tests); and the two change for
unrelated reasons — the manifest when the data moves, the mount when the
rendering does. A file edited for two unrelated reasons is the file two parallel
branches collide on.

**Widget lists are alphabetical by label.** The Widgets page, each monitor's
list in the layout editor and the F9 picker all show the catalog in that order
(`compareManifests` in `src/entities/widget/widget-catalog.ts`: label, case-insensitive,
then id), so a manifest declares no position of its own — a new widget lands
where its name puts it, and two widgets built in parallel cannot collide on a
number. Any new list of widgets shown to the user keeps that order: build it from
`WIDGETS` / `DEFAULT_WIDGETS` or sort by label, never by id or by insertion.

A panel's rows read the schema: `schemaRows(X_SETTINGS)`
(`features/widget-settings/schema-rows.tsx`) is called once per panel and
returns `Row`; `<Row setting="showPower" />` picks its control from the
field's kind (switch, colour, segmented, slider — `input` for a typed number,
`stacked` for a full-width control) and reads the widget being edited from the
panel context. `setting` is restricted at compile time to the schema's keys. A
row's title is `settingsPanels.<locale block>.<setting>`, its description
`<setting>Desc` (none if the key is absent), a choice's members
`<setting>_<member>` — or a `common.*` key, through the field's `label`, for a
string several widgets share. Locale strings stay in the shared
`locales/<lang>/widgets.json`, keyed by the setting keys. Controls with their
own logic (a slider with a unit in its tooltip, a segmented control whose
labels are not the members) still spell themselves out inside a `SettingRow`,
with their texts from `useLabels`. `schemaRows` lives in the feature, not beside
the schema, so no antd reaches a manifest, the overlay or the remote page.

A row that only qualifies another — a compass ring, a line colour, a column's
number format — declares its parent with `dependsOn` (a boolean key, or a
predicate when the gate is not one switch); anything that is not a plain row
goes in the `DependentBlock` from `panelRows<Settings>()`
(`features/widget-settings/setting-rows.tsx`).
It is hidden while the parent is off and otherwise drawn indented and joined to
the block above it, so it must sit **directly after its parent, as a direct
child of the card** — one level only. No `{settings.x && …}` in panel JSX. Gate
on whether the feature exists at all, never on a value a hotkey flips (the
Standings view mode): a row that comes and goes under the pointer is worse than
one that changes nothing.

Settings panels are collected the same way: each `*SettingsPanel.tsx` exports
`PANEL_WIDGET_IDS` (usually one id, two for the radar and flag pairs), and
`features/widget-settings/panel-registry.ts` globs them into `SETTINGS_PANELS`.
`WidgetSettings.tsx` beside it looks the panel up instead of carrying a chain of
`widgetId === '…'`. A panel for one widget sits in that widget's slice; one
serving two widgets (the radar and flag pairs) cannot — a slice does not import
its sibling — and sits in `features/widget-settings/panels/` beside the kit it
is built from (`Card`, `SettingRow`, `setting-rows`, `schema-rows`). The panels are deliberately **not** in
`mount.ts`: the remote screen renders widgets through that registry and is a
plain browser page, so a mount carrying its Ant Design panel would ship the
whole settings UI to every phone on the LAN. What keeps them out is the import
graph, not the folder — only main's panel registry globs `*SettingsPanel.tsx`.

Values shared by several manifests (`COMMON_WIDGET_DEFAULTS`, the appearance
defaults, `makeColumnLayoutResolver`) live in `src/widgets/widget-manifest.ts`.

`bindings.ts` is auto-generated — never hand-write types that duplicate
backend event shapes.

## Where a file lives

_Held by: lint (the layer direction and the sibling-slice rule, Layers above — a widget importing another widget's slice fails); review (the lowest consumer, every MobX class in a `*.store.ts` file). `docs/widget-toolbox.md` must list every module of `src/shared/lib/`, `src/shared/ui/` and `src/shared/hooks/` — test (`widget-toolbox.test.ts`)._

**A file sits next to its lowest consumer, and moves up only when its consumers
sit in different branches of the tree.** Never to a shared folder "in case",
and never because of what kind of file it is: a helper that one feature reads
belongs to that feature even when a store and a widget both read it.

| what                                                          | where                                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| everything one widget alone uses                              | `src/widgets/<name>/`: components, `settings-schema.ts`, `manifest.ts`, `mount.ts`, its store, `*-utils.ts`, hooks, its `*SettingsPanel.tsx`, stories, tests — flat; a segment folder (`ui/`, `model/`) only once it would hold more than one file |
| a store several widgets share, with its helpers               | one folder, never split: `src/features/<name>/` if it has actions (`pit-service/`), else `src/entities/<name>/` (`flags/`, `radar/`, `incidents/`, `track/`)                                                                                       |
| sim data, and derived data read across the app                | the entity that owns it: `src/entities/{sim,session,cars,player,environment,…}/`                                                                                                                                                                   |
| the widget as data (catalogue, instance, settings lifecycle)  | `src/entities/widget/`; layouts and the live widget set in `src/entities/layout/`                                                                                                                                                                  |
| something the user does in main (bindings, inspector, …)      | `src/features/<name>/` — its store, its context, and the UI section that drives it                                                                                                                                                                 |
| a main-window tab that renders widgets                        | `src/pages/<tab>/`                                                                                                                                                                                                                                 |
| the window shells, roots, sync                                | `src/app/{windows,roots,sync}/`                                                                                                                                                                                                                    |
| components used by 2+ slices                                  | `src/shared/ui/`                                                                                                                                                                                                                                   |
| DOM/browser hooks used by 2+ slices                           | `src/shared/hooks/`                                                                                                                                                                                                                                |
| pure helpers used by 2+ slices                                | `src/shared/lib/`                                                                                                                                                                                                                                  |
| types every layer reads (generated, protocol, shared choices) | `src/shared/contracts/` (generated ones in `generated/`); a type one slice owns stays in that slice                                                                                                                                                |
| a helper with one non-widget owner                            | beside that owner (`entities/layout/layout-*.ts`, `entities/sim/debug.ts`, `app/windows/main/sim-name.ts`)                                                                                                                                         |
| preview scenarios and mock builders                           | `src/features/preview/` — pages and Storybook read it, a store never does                                                                                                                                                                          |
| tests and stories                                             | next to the file they cover (`x.test.ts`, `X.stories.tsx`)                                                                                                                                                                                         |

- **A widget never imports from another widget's slice.** A second consumer
  moves the file down — to `shared/ui/`, `shared/lib/`, or the entity or feature
  that holds the shared store. One that loses its second consumer moves back
  into the slice.
- **Every MobX class lives in a `*.store.ts` file, and nothing else does**,
  with its context and hook in a `*-context.ts` beside it. A widget's own store
  is `<widget>.store.ts` in its slice, reached through its `mount.ts`.
- `src/shared/lib/` is grouped by **domain, not by kind** — one file per subject,
  never a `constants/` or `formatters/` bucket (those cut across every domain and
  tell you nothing). A new helper joins the file whose subject it shares; a new
  file needs a subject none of the existing ones covers.
- The settings-panel kit (`Card`, `SettingRow`, `setting-rows`, `schema-rows`,
  `WidgetEditorContext`, `WidgetSettings.module.scss`) is the feature
  `features/widget-settings/`; a widget's panel imports it from there.

## Decomposition rules

_Held by: lint (a hot field read directly in a component body under `src/{app,pages,widgets,features}/**/*.tsx` or `src/shared/ui/**/*.tsx`); review (everything else, including which contour a read belongs on)._

- `WidgetName.tsx` is a thin orchestrator — no monolithic render functions.
- **Every component is `observer()`** — root, sub-components, leaf nodes. `observer` = MobX subscription + automatic `React.memo`.
- **Every component in `widgets/`, `features/` and `pages/` reads the store directly** — don't pass store data as props when the component can read it itself. `shared/ui` components are the exception: they serve every slice and take props. Pass observable objects or identifiers, not derived primitives (dereferencing kills reactivity downstream).
- Root widget must not read 60 Hz fields (`carDynamics`, `carInputs`) — delegate to sub-components.
- A component that reads a hot field returns as little as possible; everything unchanged by it is created by a parent that does not re-render and arrives as `children` (`docs/rendering.md`).
- Decompose any visual section that is self-contained, has a distinct update rate, or would push the parent past ~150 lines.
- **Never read a hot field (`carDynamics`, `carInputs`, `carPositions`, `lapDelta`, and the heavy per-car frames `driverEntries`, `relative`, `proximity`, and `fieldEntries` / `relativeEntries`, the roster-joined `driverEntries` / `relative`) directly in a component body that also renders markup around it.** A single number per frame goes through `useReactiveDomWrite`; canvas widgets go through `useReactiveCanvasLoop`. `oxlint` fails the build on any direct read of these names in those `.tsx` files (`no-restricted-properties`, `.oxlintrc.json`) — a legitimate read inside `useReactiveDomWrite`/`useReactiveCanvasLoop` needs `// oxlint-disable-next-line no-restricted-properties`. That catches the fact of a direct read, not which contour it belongs on — see "How this is enforced" in `docs/rendering.md` — so get the contour right the first time; a reviewer applies that part of the rule, no tool does.

## Widget instances

_Held by: review._

Every monitor of a layout has **its own widget set**, and a monitor may hold
**several instances of one widget** — a big track map and an overview in the
corner, or the same standings on the screen being raced on and on a stream
screen with its own columns and its own scale.

| field     | means                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `id`      | the instance. Unique within the layout; what every record, patch and selection is addressed by         |
| `type`    | the widget it is an instance of — manifest, component, shipped defaults, layout resolver. Always set   |
| `monitor` | the monitor it belongs to. Absent only on templates and on the detached map of a window with no layout |

**A widget setting is a per-screen setting.** Only what may differ between
two screens showing the same widget belongs in its `settings`. Anything that
acts on the car or the sim — the pit strategy (`shared/contracts/pit-strategy.ts`), the
car length — lives in `appSettings`, edited under Settings, and is mirrored to
the overlays and the remote snapshot.

No instance is special. The record whose `id` equals its type is simply the
first one a layout got; it may be moved, switched off or deleted like any
other. Always read the widget as `widget.type`, never `widget.id`.

- A component reads **its own instance's** settings with
  `useWidgetSettings(type)`, which takes the instance from `WidgetIdContext`; a
  settings panel uses `usePanelWidgetId`. The canvas widgets read inside their
  reactive draw loop, where a hook cannot go — they take `useWidgetInstanceId`
  and read the store themselves.
- **Hotkeys act on marked instances.** Each instance carries `hotkeys` —
  absent means the default, which is on — a browser screen included, so a
  stream follows what the driver switches; read it through `hotkeysActOn`
  (`entities/layout/virtual-desktop.ts`) or `hotkeyInstancesOf(type)`. Every
  widget action works on that set: `widget:<id>:toggle-visibility` hides all of
  them while any is on screen and shows them all otherwise
  (`toggleVisibilityByHotkey`); a cycling action (`standings:cycle-view-mode`,
  the delta reference) reads the next value off one instance and writes it to
  all, so a drifted copy is brought back in line. A table on two displays is
  switched on one or both, as marked. The primary instance prefers a physical
  display over a browser screen. `isWidgetOnScreen`,
  the dispatch gate, is true while any instance is on screen.
- **A widget's own store is per instance**, declared in its `mount.ts`
  (`store: (context) => new XWidgetStore(context)`; a widget with two stores
  mounts one object holding both, as the coach does). `WidgetInstanceScope` builds it when the
  instance mounts and disposes it — reactions included — when it leaves, so a
  widget not in the window's layout runs nothing. It reads its own settings
  with `getSettings(instanceId)`; components reach it through the widget's own
  hook over `useWidgetInstanceStore`. The scope sits outside the auto-hide
  gate: a hidden instance keeps its store, and an auto-hide answer that is the
  widget's own (wheel-to-wheel) is read from it by instance id
  (`widgetInstances.storeOf`). A reaction or timer that would overwrite what a
  preview seeds starts only on a core with `startsWidgetStores`; a value a scenario forces into a per-instance store goes through
  `widgetInstances.seed`, which also reaches an instance mounted later.
- Code outside the render tree reaches instance stores through
  `core.widgetInstances` — a hotkey arriving on an overlay acts on
  `hotkeyStoresOf(type)`, the mounted instances marked for hotkeys, typed by an
  interface in `features/hotkey-bindings/hotkey-targets.ts` (a feature may not import
  a widget's store from `@widgets/**`). Main sends a **step**, never a value: only the window
  an instance is mounted in holds its state.
- The stores several widget types share (`flags`, `radar`) are
  reference-counted: a mount lists them in `sharedStores`, the first instance
  starts the store and the last stops it (`SharedWidgetStores`). Previews count
  but start nothing; a remote screen starts them (`startsWidgetStores`).
- **App-wide widget stores are the exception**, and only for state that is
  not one instance's: the shared ones above, the pit service (the order goes
  to one car, and main sends it with no widget mounted) and the recorded track
  (one shape per track, read by the pit service too). Each is one folder below
  `widgets/`: `features/pit-service/`, `entities/{flags,radar,track}/`.
- **An app-wide widget store reads `settingsOfType(type)`**, never
  `getSettings(type)`: one store per app cannot be per instance, so it follows
  the one that speaks for the widget — `primaryInstanceOf`, a switched-on
  instance under the hotkeys. A `getSettings` keyed by the type finds nothing
  once that record is deleted.
- The editor lists **every widget per monitor**, each with its own switch
  (`monitorWidgetRows`); the switch and the overlay's F9 picker both go through
  `setTypeEnabledOnMonitor`, which switches back on an instance already on that
  monitor — settings intact — or makes one from the widget's template. The F9
  picker reaches it as the `enableTypeOnMonitor` command: main picks the id and
  the spot, and only on the sender's own monitor.
- Instances are numbered **per monitor** (`copyOrdinalOf`): the first one of a
  widget on a monitor is the widget on that screen, a further one there is a
  copy. Deleting is `removeWidgetCopy`, and it takes only copies — the first
  instance is taken off by its monitor's switch and keeps its settings.
  Removing a monitor deletes its widgets with it.

## Widget appearance

_Held by: test (a `contentSized` widget that does not paint its own plate — `widget-catalog.test.ts`; the handles each kind is offered — `widget-frame.test.ts`; a transition outside the state-change list, or an infinite animation — `widgets/widget-transitions.test.ts`); review (the rest)._

- **Nothing animates between bundles.** A value that moves with telemetry is set on the overlay clock, without a CSS `transition` or `animation`: one re-run by each value never stops, and keeps the overlay — and DWM on the game's GPU — redrawing at the monitor's rate whatever the clock says (ADR-0009). A transition is for a change of state (a light switching on, the limiter engaging) and is listed with its reason in `STATE_CHANGE_TRANSITIONS`. Anything that flashes goes through `useBlink` (`shared/hooks/useBlink.ts`) and styles its steps on `data-blink-step` — never an `infinite` animation, which redraws on every display refresh for as long as it runs; a one-shot animation on a change of state is fine.

- `WidgetContainer` applies opacity and radial-gradient background from user settings — don't hardcode background in the widget. (Exception: `backgroundColor: 'transparent'` defaults may apply a custom CSS background on `WidgetPanel` with an explanatory comment.)
- Root element is always `<WidgetPanel>` — never a bare `<div>`.
- Layout: flexbox with `flex: 1 1 0` and `min-width: 0`. Column sizing: `ch` units when max char count is known.
- **Resize handles only where the widget changes** (`resizeDirectionsFor`, `entities/widget/widget-frame.ts`): eight for a plate that stretches both ways, `e`/`w` for `autoHeight`, **corners only for `contentSized`** — a plate as wide and tall as its content (a column that leaves the row narrows it) stretches in neither axis, so a drag can only scale it. Such a widget declares `contentSized` with `transparentContainer` and paints its own ground from `--widget-bg` (`widget-catalog.test.ts` holds the pairing); its frame hugs the plate.

## Canvas components

_Held by: review._

Per-frame mutable state (circular buffers, smoothing) → `useRef`. Schedule draws via RAF inside `useLayoutEffect`; cancel on cleanup. Resize via `ResizeObserver`; call `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` after resize. DPI: `ctx.scale(devicePixelRatio, devicePixelRatio)`.

## New widget checklist

Building one from an idea? Follow the route first —
[`docs/widget-authoring.md`](docs/widget-authoring.md) orders these steps by cost
(telemetry before markup, boilerplate last) and says what enforces each one, and
[`docs/widget-toolbox.md`](docs/widget-toolbox.md) lists every helper, shared
component, hook and design token that already exists. The skill
`.claude/skills/new-widget/` walks the same route and writes the files. The
checklist below is what a reviewer applies to code that already exists.

1. Root element = `<WidgetPanel>`
2. No hardcoded background
3. Decompose from the start
4. Every component `observer()`
5. Add `*.stories.tsx` through `defineWidgetStories` — see `docs/widget-stories.md`
6. Add `*SettingsPanel.tsx` in the widget slice, built on `schemaRows`, and export `PANEL_WIDGET_IDS` from it — the panel registry picks it up, nothing else to wire
7. Describe every setting once in the slice's `settings-schema.ts` (`defineSettings`), with its strings under `settingsPanels.<locale block>` in all four `locales/*/widgets.json`, keyed by the setting keys — no shared settings type to edit. The `catalog.<id>.description` is one short sentence, two at most, 80 characters or fewer in every language: the widget list clamps it to three lines (`widget-locales.test.ts`)
8. Create `manifest.ts` and `mount.ts` in the slice, the manifest spreading the schema's `defaults` and naming it as `settingsSchema` — both are collected by glob, so no shared file is edited
   8a. Declare `telemetryEvents` in the manifest for every gated field the widget
   reads (`carDynamics`, `carInputs`, `carPositions`, `lapDelta`, `driverEntries`,
   `relative`, `proximity`, `incidents`, `coach`, `safetyRating`, `inputSamples`) — without it the backend never sends them (see
   Demand-gated bundle fields)
   8b. If any of those is a hot field, keep the component that reads it down to
   one or two elements and pass the static part in as `children` — splitting into
   smaller components does not help, the parent still allocates every child
   element. There is no test for this; get it right by review. See `docs/rendering.md`
9. Use `fs()`/`sp()`/`radius()` tokens, `$font-widget`, `$widget-text-primary/secondary`, `$race-*` palette
10. Document it: a picture in `site/assets/widgets/` taken from its story (a line in `SHOTS` in `scripts/capture-widgets.mjs`, then `npm run capture:widgets` with Storybook up — it also refreshes the site's WebP copies in `site/assets/img/`), a section in `README.md`, and one card in the site gallery (`site/index.html`) with its line in the catalogue and in `site/i18n/` — one set of pictures serves both; see `docs/widget-authoring.md` step 12

## Storybook

_Held by: review._

Full guide: [`docs/widget-stories.md`](docs/widget-stories.md) — read it before writing or changing a story.

- Every widget story goes through `defineWidgetStories` (`src/storybook/define-widget-stories.tsx`): it provides the store, the frame, the scenario base and the `runInAction` seeding. No hand-rolled `render`, decorator or `runInAction` in a story file.
- **The widget's settings are Controls automatically** — read from its `manifest.ts`, written back with `updateUserSettings`. A story never redeclares them; a `choice` in the widget's `settings-schema.ts` shows as a select.
- Seed with the mock builders in `features/preview/mocks/` and data-store setters; scenario knobs are optional and folded with `whenSet` so they do not overwrite a named scenario.
- Named `const` PascalCase exports; the only default export is `meta`. No anonymous functions.

---
