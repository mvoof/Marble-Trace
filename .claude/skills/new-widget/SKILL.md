---
name: new-widget
description: Use when building a new overlay widget in this repository, or when the user asks to add a widget, scaffold one, or says "/new-widget". Walks the route in order — telemetry first, boilerplate last — asks the decisions it cannot make, and writes the files it can.
version: '1.2.0'
---

# New widget

The route is documented in **[docs/widget-authoring.md](../../../docs/widget-authoring.md)**.
This walks it. A step here is an imperative and a link — the reasoning stays in
the document, so read the linked section when a step is not obvious rather than
guessing.

**Order matters.** Telemetry comes first because a widget built against a field
the sim does not carry is not fixable by editing the widget. Boilerplate comes
last because it is cheap to redo.

**Do not fill in a choice nobody made.** A widget with settings it does not use,
or a `telemetryEvents` it does not read, is worse than one with neither. Where a
step below says _ask_, ask — do not pick a plausible default and move on.

**Five steps here fail silently** — 1, 7, 8, 11 and 12. Nothing goes red; the
widget just comes out empty, or unlabelled, or without a panel, or undocumented.
Give those five more attention than the ones a command checks.

---

## Step 1 — Telemetry

**Ask:** what does this widget read, and where does that value come from?

Then confirm each field exists, in this order:

1. Offline: grep `src/shared/contracts/bindings.ts`. It is the generated contract and the
   only honest list. Raw sim frames are **snake_case** (`velocity_x`) — they keep
   kerb's names; the envelope and computed frames are camelCase. Search a raw
   field in snake_case.
2. Against a live sim: the Telemetry Inspector (Settings → Maintenance) shows the
   raw `SourceFrame`, a superset of the bundle.

If a field does not exist, **stop and say so.** Adding it is the backend route
(`sources/` → `computations/` → a specta type → a bundle tier), not this one.

Record for each field its **rate tier** — the table is in
[architecture.md](../../../docs/architecture.md) → Rate tiers.

**The gated fields are the exports of `src/shared/contracts/telemetry-event-bits.ts`
(generated from Rust). Open that file — it is the list, and it grows.**
The four on the 60 Hz tier (`carDynamics`, `carInputs`, `carPositions`,
`lapDelta`) are **hot**; note which you use, steps 3 and 9 depend on it.

Every gated field the widget reads goes in `telemetryEvents`. One that is read
and not declared renders the widget **empty in the app and correct in
Storybook**. One that is declared and not read costs every window the traffic.

**Also decide `requiredCapabilities`** — a different thing from the mask: it
hides the widget from the catalog on a sim that cannot feed it. A widget reading
the player's own `carDynamics` / `carInputs` declares `['playerDynamics']`. The
others in use: `chassis`, `fuel`, `inputs`, `radar`, `relative`, `sectors`,
`standings`, `weatherCurrent`. Check what a neighbouring widget reading the same
frame declares.

## Step 2 — Store or no store

**Ask** only if it is genuinely unclear. The rule decides most cases: a widget
store exists when the widget has UI state, timers, or non-trivial derived logic.
Otherwise components read the entity stores directly and there is no store file.

Shared derived logic used by two or more widgets is a `computed` on the entity
store, not a second widget store. See
[architecture.md](../../../docs/architecture.md) → The six store rules.

**Done when** you can name, for every value the widget draws, where it comes
from. A value with no owner means this step is not finished.

## Step 3 — Shape

**Ask:** what does it look like, and how big is it at design scale?

Decide, and write down before any file:

- `designWidth` / `designHeight`. If columns are toggleable, `designWidth` is
  computed by a `compute…DesignWidth` in the widget's `*-utils.ts` and driven by
  `makeColumnLayoutResolver` — copy the pattern from
  `src/widgets/close-battle/manifest.ts`.
- **The layout knobs**, which are easy to miss because they are all optional:
  `autoHeight`, `lockAspectRatio`, `scaleFromHeight`, `overflowVisible`,
  `transparentContainer`. Read the doc comments on `WidgetMeta` in
  `src/shared/contracts/widget-settings.ts`. A non-rectangular plate also needs a case in
  `widgetFrameBorderRadius` (`src/entities/widget/widget-frame.ts`).
- The component split. `<Name>Widget.tsx` is a thin orchestrator. A component
  that **reads a store** is `observer()` and reads it directly rather than taking
  derived props; a presentational shell taking only props need not be one
  (`WidgetPanel` and `SettingRow` are plain arrows).

**Then branch on the hot field — this is the decision, not a detail:**

- **One number (or a few) per frame, driving a position, a width or a color** →
  `useReactiveDomWrite`. The value goes straight to a DOM node or a CSS custom
  property and the component wakes **zero** times. For a single-number widget
  this is the intended answer, not a later optimisation.
- **A subtree whose shape changes** → the React rule: the root does not read the
  hot field, the component that does returns as little as possible, and the rest
  arrives as `children` from a parent that does not re-render.
  [rendering.md](../../../docs/rendering.md) → The rule.

**Done when** you can name the component that reads the hot field and say which
branch it is on — this is what step 9 checks by review.

## Step 4 — Check the toolbox

Before writing any helper, component or hook, read
**[docs/widget-toolbox.md](../../../docs/widget-toolbox.md)** — every existing
helper, shared component and hook with one line on when to use it, plus the
`fs()` / `sp()` / `radius()` / `ws()` tokens and the rule for where a new helper
belongs.

## Step 5 — Settings

**Ask** which settings the widget actually needs. Then write
`src/widgets/<kebab-name>/settings-schema.ts` — one description per setting,
nothing else declares them:

```ts
import {
  bool,
  choice,
  defineSettings,
  num,
  type SettingsOf,
} from '@shared/lib/widget-settings-dsl';

export const <NAME>_SETTINGS = defineSettings('<localeBlock>', {
  /** What the switch does, for the next reader. */
  showThing: bool(true),
  barWidth: num(8, { min: 4, max: 20, step: 1 }),
  displayMode: choice(['compact', 'full'], 'full'),
});

export type <Name>WidgetSettings = SettingsOf<typeof <NAME>_SETTINGS.shape>;
```

Builders: `bool`, `num` (bounds required; out of range is clamped on load),
`choice` (string or number members), `color`, `numRecord`, `nullable(field)`.
A choice several widgets share comes from `shared/contracts/widget-choices.ts`.
Every setting has a default — none is optional. `<localeBlock>` is the
camelCase block under `settingsPanels` in step 7.

No settings migration is needed — a widget stores only overrides, and a new key
reads its default from the schema. Say so rather than writing one.

## Step 6 — Generate `manifest.ts` and `mount.ts`

Both in `src/widgets/<kebab-name>/`. Mechanical once steps 1, 3 and 5 are
answered — generate them.

Declare no `order` or position: every widget list is alphabetical by `label`,
so the label alone decides where the widget appears.

`manifest.ts` is **plain data and never imports its own component**:

```ts
export const <NAME>_MANIFEST: WidgetManifest = {
  id: '<kebab-id>',
  telemetryEvents: [/* the gated fields from step 1, and nothing else */],
  requiredCapabilities: [/* from step 1 */],
  label: '<Label>',
  description: '<one line>',
  designWidth: <n>,
  designHeight: <n>,
  /* the layout knobs from step 3, if any */
  userSettings: {
    enabled: false,
    x: 200,
    y: 200,
    currentWidth: <designWidth>,
    currentHeight: <designHeight>,
    ...COMMON_WIDGET_DEFAULTS,
    ...PANEL_APPEARANCE_DEFAULTS, // or TRANSPARENT_APPEARANCE_DEFAULTS
    ...<NAME>_SETTINGS.defaults,
  },
  settingsSchema: <NAME>_SETTINGS,
};
```

`mount.ts` is four lines: `{ id, component }`. Both are collected by glob —
**register nothing anywhere else.**

## Step 7 — Strings, in four languages

**Fails silently. Do not skip it.** Nothing in the manifest reaches the driver's
eyes: the catalog description and every panel label are i18n keys in
`src/locales/{en,es,ru,zh}/widgets.json`.

```
catalog.<widget-id>.description
settingsPanels.<localeBlock>.<setting>           # row title
settingsPanels.<localeBlock>.<setting>Desc       # description, optional
settingsPanels.<localeBlock>.<setting>_<member>  # a choice's members
```

The catalog description is one short sentence (two at most), **80 characters or
fewer in every language** — the widget list clamps it to three lines, and a test
fails a longer one.

The keys are the setting keys. All four locales with the same keys —
`widget-locales.test.ts` fails on a key one language lacks, but a widget missing
from all four passes every command while the driver reads raw keys.

## Step 8 — Panel and story

`<Name>SettingsPanel.tsx` goes in the widget's own slice, and `mount.ts`
never imports it — the remote screen renders widgets through the mount registry
in a plain browser, and a mount carrying Ant Design would ship the settings UI to
every phone on the LAN. Main's panel registry finds it by glob.

**Copy `src/widgets/g-meter/GMeterSettingsPanel.tsx`.** It shows both kinds of
row in place: `<Row>` from `schemaRows`, and a control written out by hand with
`useWidgetEditor()`, `usePanelWidgetId(fallbackId)` and `useLabels`.

Two constraints not visible in the file you copy:

- It must export `PANEL_WIDGET_IDS` — that is what the glob keys on.
- It must export **exactly one component**. `panelOf` takes the first export that
  is not `PANEL_WIDGET_IDS`, so a second exported component registers the wrong
  one, silently.

Rows read the schema: `const { Row } = schemaRows(<NAME>_SETTINGS)` once per
panel, then `<Row setting="…" />` — the control follows the field's kind
(`stacked`, `input` adjust it), the labels follow the key. Write a control out
by hand only when it has logic of its own. Blocks inside a `Card` are
separated automatically by `.cardContent > * + *` — **do not add dividers by
hand**, there is no `Divider` in this tree. A row that only qualifies another
takes `dependsOn="parentKey"` (or goes in a `DependentBlock` from
`panelRows<Settings>()`) and sits directly
after its parent — never `{settings.x && …}` in the panel.

`<Name>Widget.stories.tsx`: **read [widget-stories.md](../../../docs/widget-stories.md)
first** and follow it. In short: spread `defineWidgetStories({ widget, size,
seed, seedSnapshot, args, argTypes })` from `@/storybook/define-widget-stories`
— it mounts the widget with its frame and does the seeding. The widget's
settings become Controls by themselves; `StoryArgs` holds only telemetry knobs,
seeded through `features/preview/mocks/` builders and `whenSet`. A `choice`
in the schema shows as a select by itself.
One story per state worth seeing, starting with the race look the site picture
is taken from. Named `const` PascalCase exports, only `meta` as default.

## Step 9 — The hot/cold split, if a hot field was declared

There is no test for this — it is enforced by review, not by a runner. Read
[rendering.md](../../../docs/rendering.md) before writing the component:

- A component that reads a hot field returns as little as possible; the static
  rest is lifted into a parent that never re-renders and passed down as
  `children`.
- A single number per frame goes through `useReactiveDomWrite`
  (`shared/hooks/useReactiveDomWrite.ts`) instead of React.
- More, smaller components does not fix this — every child still costs a
  `jsx()` allocation from its parent each frame.

## Step 10 — Checks

```bash
npm run typecheck
npm run lint
npm test
```

## Step 11 — Run it in the app

**This is the last step, not a green suite.** The widget has to render under
`--wfs` scaling, over a transparent always-on-top overlay, in a window that is
not Storybook's.

```bash
npm run tauri:dev
```

Then the Tauri MCP bridge: `driver_session` (action `start`, port 9223), then
`webview_screenshot`. Never a plain browser.

Look for the four failures only visible here — one per quiet step:

1. **Empty widget** — a gated field read but not declared (step 1).
2. **Raw i18n keys** where labels belong (step 7).
3. **No settings panel**, or the wrong one (step 8).
4. **Wrong scale** — a `rem`, a `vw`, a raw px where a token belonged, or a
   `WidgetPanel` pinned at its default 200px `minWidth` (steps 3 and 4).

Report what the screenshot shows.

## Step 12 — README and site

[widget-authoring.md → Step 12](../../../docs/widget-authoring.md#step-12--put-it-in-the-readme-and-on-the-site).
Nothing collects these; do all three.

1. Add `'<file>': ['<Title>Widget', '<story>']` to `SHOTS` in
   `scripts/capture-widgets.mjs`, pointing at a story seeded the way the widget
   looks in a race — write one if none is (`withReplay` from
   `src/storybook/with-replay.tsx` for a widget that draws a history). Ask the
   user to run `npm run storybook`, or run it if it is not up, then
   `npm run capture:widgets -- <file>`
   ([docs/widget-screenshots.md](../../../docs/widget-screenshots.md)).
   It refreshes the site's WebP copies in `site/assets/img/` too — they are
   part of the change. Stop Storybook afterwards.
2. `README.md`: a `### <Name>` section in its group with one or two sentences and
   `<img src="site/assets/widgets/<file>.png" alt="<Name>" width="…">` — width
   a third of the PNG's — plus a link in the group's line under **Widgets**.
3. `site/index.html`: one card in the gallery sheet, in its group — a copy
   of a neighbour's `<li>` with `id`, `data-shot`, `data-name`, `data-alt`,
   `data-group`, `data-desc-id` and the caption changed — and its one-line
   description as a `catalog-item` in the catalogue under the gallery, with
   `<dd id="gw-desc-<file>">`. Then `npm run i18n:sync` in `site/` and the
   new strings translated in `site/i18n/{ru,es,zh}.json`; the widget's name
   stays English.

Do not call the widget done before steps 11 and 12.
