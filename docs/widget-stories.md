# Writing a widget's stories

How to give a widget its `<Name>Widget.stories.tsx`: what the shared helper
already does for you, what a story still has to say, and the mistakes that make
a story lie about the widget. Written for whoever writes the file — a person or
an agent — and read best top to bottom once, then used as a reference.

The stories are the widget's **second test bench** (the app over the Tauri MCP
bridge is the first): every state the widget can be in, one click apart, with
its settings on the Controls tab. They are also where the site's picture of the
widget is taken from (`scripts/capture-widgets.mjs`), so a story is not optional
and not throwaway.

---

## The parts

| file                                      | does                                                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/storybook/define-widget-stories.tsx` | `defineWidgetStories` — builds the whole `meta` but its title; `previewScenario` — names a scenario for a story |
| `src/storybook/widget-settings-args.ts`   | turns the widget's settings into Controls and writes them back into the store                                   |
| `src/storybook/setting-options.ts`        | the members of every string-union setting, for the select controls                                              |
| `src/storybook/story-overrides.ts`        | `whenSet` — a story argument that only overrides the frame when the story set it                                |
| `src/storybook/with-replay.tsx`           | `withReplay` — plays a burst of frames after mount, for widgets that draw a history                             |
| `src/storybook/widgetDecorator.tsx`       | the frame standing in for `WidgetContainer` — size, ground, border, `--wfs`                                     |
| `.storybook/decorators.tsx`               | `withStore` — a fresh `PreviewCore` per story, provided through the context                                     |
| `src/preview/scenarios.ts`                | the named scenarios (`PreviewScenarioId`) shared with the in-app layout-editor preview                          |
| `src/preview/mocks/*.ts`                  | mock builders — `mockFuel`, `mockProximity`, `mockField`… — that derive a frame the way the backend does        |

The widget is **not** rewritten for Storybook. It reads its stores exactly as in
the app; a story only decides what is in those stores.

---

## What `defineWidgetStories` does for you

For every story, on mount and again on every change of a control:

1. Provides a fresh `RendererCore` (`withStore`) and marks the sim connected, so
   the widget does not show its "no data" placeholder.
2. Lays down the base: the story's **scenario** if it names one
   (`parameters: previewScenario(id)`), otherwise the shared telemetry snapshot
   if the meta asked for it (`seedSnapshot: true`).
3. Writes **the widget's settings** from the Controls into the store with
   `updateUserSettings` — every setting, not only the changed one, so a control
   put back to its default restores it.
4. Runs the meta's **`seed(store, args, scenarioId)`** last — it has the final
   word over everything above.
5. Draws the widget inside the frame (`size`, overridable per story with
   `parameters: { widgetFrame: { … } }`).

All of it inside `runInAction`. A story file never calls `runInAction`,
`useStore` or a decorator of its own for seeding.

### Settings as Controls — automatic

The widget is found from its component through its `mount.ts`, and its shipped
`userSettings` from `manifest.ts` become args under a **Widget settings** group:

| setting holds                                 | control      |
| --------------------------------------------- | ------------ |
| `boolean`                                     | toggle       |
| `number`                                      | number field |
| `#rrggbb` / `rgba(…)`                         | color picker |
| a string union listed in `setting-options.ts` | select       |
| an object (column sets and the like)          | JSON editor  |

Left out on purpose — the frame replaces `WidgetContainer` in a story, so they
would do nothing: `enabled`, `x`, `y`, `currentWidth`, `currentHeight`,
`opacity`, `fontScale`, `backgroundColor`, `borderColor`.

So a **new setting needs nothing in the story**: it appears on the Controls tab
by itself. One exception — a new **string union** shows as a plain text field
until its members are added to `SETTING_OPTIONS` in
`src/storybook/setting-options.ts`:

```ts
scaleMode: allOf<RadarScaleMode>()('fixed-scope', 'fixed-cars', 'manual'),
```

`allOf` fails to compile when a member is missing or misspelled, so the list
cannot drift from the type. A key two widgets use for different unions gets the
select only where its default is one of the listed members.

A story rendering something that is not a mounted widget (a sub-component, a
pair of widgets) gets no settings. Pass `widgetId` to `defineWidgetStories` to
name the widget explicitly.

---

## Writing the file

### 1. The meta

```ts
import type { Meta, StoryObj } from '@storybook/react-vite';

import { mockProximity } from '@preview/mocks/traffic';
import type { MockTrafficCar } from '@preview/mocks/traffic';
import { ProximityRadarWidget } from './ProximityRadarWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

interface StoryArgs {
  /** The cars around the player. Undefined keeps the scenario's own traffic. */
  cars?: MockTrafficCar[];
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/ProximityRadarWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: ProximityRadarWidget,
    size: {
      width: 180,
      height: 180,
      background: 'transparent',
      border: 'none',
    },
    seed: (store, args) => {
      if (args.cars !== undefined) {
        store.backendComputed.updateProximity(mockProximity(args.cars));
      }
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;
```

- **`title` stays a literal** in the object, and the rest is spread in:
  Storybook's indexer reads the title statically. The title is
  `Widgets/<ComponentName>` — the capture script builds story ids from it.
- **`StoryArgs` holds the scenario knobs only** — what the telemetry looks like
  (`cars`, `fuelLevel`, `state`). The settings are already there; do not
  redeclare them.
- **`size`** is the design size from the manifest. A widget that sits on
  nothing on the overlay (radar, delta, track map, flags) takes
  `background: 'transparent', border: 'none'`. A widget whose height follows its
  content (`autoHeight` in the manifest) gives only `width` — a fixed `height`
  crops it, and the cropped frame is what the site's picture is taken from.
- **`seedSnapshot: true`** when the widget needs a believable session around it
  (driver list, track, timing) and the stories do not each name a scenario.
- **`args` / `argTypes`** on the meta: defaults and controls for the scenario
  knobs. An `argTypes` entry for a setting key refines the generated one rather
  than replacing it.

### 2. The seed

The seed turns story args into store writes, with the mock builders:

```ts
seed: (store, args) => {
  store.backendComputed.updateFuel(mockFuel({ ...fuelOverrides(args) }));
},
```

- **Write through the data stores' own setters** (`updateProximity`,
  `updateFuel`…) with frames from `src/preview/mocks/`. Never hand-build a
  frame object: the builders derive dependent fields the way the backend does,
  and a hand-built one drifts the day the frame changes.
- **Respect the scenario under you.** The seed runs after the scenario, so an
  argument written unconditionally overwrites the base the story named. Make
  scenario knobs optional and fold them with `whenSet`, which writes only what
  a story actually set:

  ```ts
  ...whenSet(args.lapsRemaining, (laps) => ({ lapsRemaining: laps })),
  ```

- **Settings belong to the Controls, not the seed.** A seed that also writes a
  setting (`updateUserSettings`) wins over its control — the toggle on the
  Controls tab then does nothing. Do it only when a story's whole point is a
  setting the scenario cannot express, and then name it as that story's arg so
  the two agree.
- `store.appSettings.dragMode = true` shows the widget as it looks in the
  layout editor (frames, in-place controls) — for a story about that, not by
  default.

### 3. The stories

One `export const` per **state worth looking at**, each saying only how it
differs:

```ts
// The base itself, for the widget at rest.
export const NoCars: Story = { args: { cars: [] } };

// A declared scenario as the starting state: no seeding code at all.
export const Surrounded: Story = {
  parameters: previewScenario('radar-traffic'),
};

// A scenario, with one knob turned on top of it.
export const ManualFuelOrder: Story = {
  parameters: previewScenario('pit-service'),
  args: { fuelOrdered: 40, fuelCalculated: 34.2 },
};

// A setting the state is about — set it as an arg, the Controls show it.
export const HiddenWhileUnavailable: Story = {
  args: { state: 'Unavailable', hideWhenUnavailable: true },
};

// A different frame for one story (a vertical layout).
export const Vertical: Story = {
  args: { orientation: 'vertical' },
  parameters: { widgetFrame: { width: 90, height: 400 } },
};
```

Which states to cover, in this order:

1. **The race look** — the state the site picture is taken from. Seed it the way
   the widget looks mid-race, not empty.
2. **Every branch the widget draws differently** — warnings, empty data, the
   flag colours, each layout a setting switches to.
3. **The edges** — longest name, the most rows, the widest number, a negative
   value: whatever could overflow or re-centre the readout.
4. **The tallest it gets** — for a widget with `autoHeight`, the state with the
   most content, so a crop shows up here and not on the overlay.

### 4. Widgets that draw a history

A trace, a trail, a chart builds itself from successive frames, and a seed hands
it one. Replay a burst after mount:

```ts
export const Showcase: Story = {
  decorators: [withReplay(seedInputHistory)],
};
```

`seedInputHistory` lives in `src/preview/preview-animator.ts`, shared with
the in-app preview. See `InputTraceWidget`, `GMeterWidget`, `LapLogWidget` for
working ones.

### 5. Scenarios — when to add one

A scenario (`src/preview/scenarios.ts`, id in
`src/types/preview-scenarios.ts`) is shared with the layout editor's preview
picker. Add one when the **app** should be able to show that state too — a flag,
a pit stop, three-wide traffic. A state only one story needs stays in that
story's args. **Nothing that exists only for a story may be added to
`preview/`**, and nothing in `preview/` may import from
`src/storybook/` (the app must never depend on Storybook).

---

## Rules

- Named `const` PascalCase exports; the only default export is `meta`. No
  anonymous functions — a seed helper is a named `const`.
- Every story renders through `defineWidgetStories` — no hand-rolled
  `render`, no own `withStore`, no `runInAction` in the file.
- Seed through mock builders and data-store setters; never write a widget
  store's state directly.
- Declare the widget's `telemetryEvents` in its manifest even though Storybook
  renders without them: a widget reading a gated field it did not declare
  **renders correctly here and empty in the app**. A story passing proves
  nothing about that.
- A story is not a test of `--wfs` scaling or of the overlay window. Run the
  widget in the app before calling it done (`docs/widget-authoring.md`,
  step 11).

## Checking it

```bash
npm run storybook          # :6006 — open Widgets/<Name>Widget
npm run typecheck          # catches a missing member in SETTING_OPTIONS
```

On each story: the state looks as named; every control on **Widget settings**
changes what it says; nothing is cropped at the frame's edge. Stop Storybook
afterwards — it is heavy, and nothing else heavy should run beside it.

## The picture for the site

Point one line of `SHOTS` in `scripts/capture-widgets.mjs` at the race-look
story — `'<file>': ['<Name>Widget', '<story-name-in-kebab-case>']` — and run
`npm run capture:widgets -- <file>` with Storybook up. It writes
`site/assets/widgets/<file>.png` and the site's WebP copies. If the key is
renamed, the site and `README.md` must be pointed at the new file and the old
PNG and its copies removed. Full step: `docs/widget-authoring.md`, step 12.
