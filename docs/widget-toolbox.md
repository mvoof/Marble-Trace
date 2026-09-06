# The widget toolbox — what already exists

The answer to "does this already exist?", read rather than grepped.

Every module under `src/utils/`, every component under `src/ui/shared/` and
every hook under `src/ui/hooks/` is listed here with one line saying when to
reach for it. The list is checked by `docs/widget-toolbox.test.ts`: a module in
the tree and not on this page fails `npm test`, so the page cannot quietly go
stale. What the line beside an entry _says_ is written by hand and is the whole
value of the page — nothing can infer it, and nothing tests it.

Read this at step 4 of [the route](widget-authoring.md), before writing a helper.

---

## Where a new helper belongs

The rule is [`AGENTS.md` → Where a widget's files live](../AGENTS.md), in one
sentence: **one consumer → the widget folder, two or more → the shared folder.**

| Consumers                        | Goes in                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------- |
| One widget                       | `src/ui/widgets/<Widget>/` — `*-utils.ts`, its own hook, its own sub-components |
| Two or more widgets, pure        | `src/utils/`                                                                    |
| Two or more widgets, renders     | `src/ui/shared/`                                                                |
| Two or more widgets, touches DOM | `src/ui/hooks/`                                                                 |
| One widget **and** a store       | `src/utils/`, even at two files — a store importing `@ui/**` is a lint error    |
| One non-widget owner             | beside that owner (`store/settings/…`, `ui/app/main/…`), never `src/utils/`     |

`src/utils/` is grouped by **domain, not by kind** — one file per subject, never
a `constants/` or `formatters/` bucket. A new helper joins the file whose
subject it shares; a new file needs a subject none of the existing ones covers.

A helper that gains a second consumer moves up; one that loses it moves back
down into the widget.

---

## `src/utils/` — pure helpers

No React, no stores, no Tauri. Importable from any layer.

| Module                     | Reach for it when                                                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animation.ts`             | You need the FLIP row-move duration (`MOVE_DURATION_MS`) on both sides of an animation — the hook that plays it and the store that has to know when it ends.                |
| `backend-constants.ts`     | You need a backend default as a compile-time literal (pit warning laps, fuel window bounds, default car length, default class color). **Generated from Rust — never edit.** |
| `backend-events.ts`        | You need a `sim://…` or `chat://…` event name. **Generated from Rust — never edit**; `platform/sync/sim-events.ts` re-exports these and adds the frontend-only ones.        |
| `canvas.ts`                | Drawing on a canvas or an SVG: car-dot geometry and shape-per-class, `resizeCanvasToDpr`, cell dividers, scroll-thumb metrics.                                              |
| `car-identity.ts`          | You need a `DriverEntry` with its four per-tick numbers stripped off — the shape widgets draw and `BackendComputedStore` compares. Build it here and nowhere else.          |
| `car-signals.ts`           | Anything RPM or steering: shift thresholds, RPM zone state and its colors, steering angle in degrees, normalized steering.                                                  |
| `colors.ts`                | Turning data into a color: class color parsing, contrast text color, sector colors, air and track temp colors, the player-row style.                                        |
| `delta-utils.ts`           | Formatting or classifying a lap delta: `formatDelta`, gauge ranges, ahead/behind state, sector times and sector deltas, the sim's own delta fields and their `_ok` flags.   |
| `driver.ts`                | Anything about a driver or their car identity: name abbreviation and splitting, car number, iRating, brand, incident limits, flag bits, class SoF.                          |
| `driver-flair.ts`          | Mapping an iRacing flair id to a country code (for `CountryFlag`).                                                                                                          |
| `driving-coach-utils.ts`   | Reference-lap maths: interpolating a reference sample, target-speed profiles, corner targets, tire wear, condition mismatch, the brake/gas/grip advisory.                   |
| `flag-zones.ts`            | Incident and flag zones on a track line: computing them, measuring them, splitting one across start/finish, projecting one into a window.                                   |
| `fuel-constants.ts`        | Fuel colors, chart configuration and the low-fuel thresholds — shared by the fuel widget and anything that shows a fuel figure.                                             |
| `qualifying-visibility.ts` | Honouring a widget's "show in qualifying" setting (`never` / `auto`) — the shared rule behind that switch.                                                                  |
| `radar-constants.ts`       | Radar geometry (car width, corner radius, lateral offset) and the gap-to-color ramps used by every proximity view.                                                          |
| `remote-screen.ts`         | Anything about remote screens as monitors: telling a remote monitor from a display, presets, bounds placement, slugs.                                                       |
| `telemetry-format.ts`      | Rendering a raw SI number for the driver in their unit system: speed, temperature, fuel, distance — and converting back.                                                    |
| `timer-utils.ts`           | Clocks and session state: wall clock, sim date and time, session ended / race started, lap-limited vs timed, the session clock, `splitTime`.                                |
| `weather-utils.ts`         | Weather rendering: wind color and bearing, track wetness, and the 0..1 fractions the gauges are drawn from.                                                                 |
| `widget-instance.ts`       | Anything touching a widget _copy_: `widgetTypeOf` (**always** use it, never `widget.id`), the next instance id, the type behind an id.                                      |

---

## `src/ui/shared/` — components used by two or more widgets

| Component           | Reach for it when                                                                                                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CarDot`            | Drawing a car marker on a map or a radar — class color, shape per class, contrast label, plus the chevron and crown markers.                                                                                                                               |
| `CountryFlag`       | Showing a driver's flag from a country code (see `driver-flair.ts` for the id → code step).                                                                                                                                                                |
| `DriverFlagBadge`   | Showing a waved flag against a driver — blue, meatball, black.                                                                                                                                                                                             |
| `DriverStatusBadge` | Showing a driver's state, and `DriverStatusBadges` for the whole row of them.                                                                                                                                                                              |
| `ErrorBoundary.tsx` | Wrapping a subtree that may throw, so one widget cannot take the overlay down with it.                                                                                                                                                                     |
| `NoDataPlaceholder` | The widget has nothing to show yet — the standard "NO DATA" plate instead of an empty box.                                                                                                                                                                 |
| `RatingBadge`       | Showing a licence class and safety rating (`LicBadge`).                                                                                                                                                                                                    |
| `ReservedSlot`      | Holding the height a block will occupy while it is absent, so placing the widget in the editor shows its real size.                                                                                                                                        |
| `ScrollIndicator`   | A list is taller than its window — the thumb, driven by `scrollThumbFor` in `canvas.ts`.                                                                                                                                                                   |
| `StatPill`          | A labelled figure with an icon, boxed (`chip`) or bare (`inline`), toned muted / accent / warning / danger.                                                                                                                                                |
| `TireBadge`         | Showing a tire compound.                                                                                                                                                                                                                                   |
| `WidgetLabel`       | A widget's small caption text — uppercase and mono are props, not new classes.                                                                                                                                                                             |
| `WidgetPanel`       | **The root element of every widget.** Never a bare `<div>`; it carries direction, gap, fit and edge inset. Watch `minWidth`: it **defaults to 200**, applied as `calc(200px * var(--wfs))`, so a narrower widget is silently pinned — pass `minWidth={0}`. |
| `WidgetValue`       | The primary number of a block, with its unit and an optional data-driven color.                                                                                                                                                                            |

---

## `src/ui/hooks/` — DOM and browser hooks used by two or more widgets

Hooks are for the DOM and the browser only. Everything else belongs in a store
([`AGENTS.md` → MobX Stores](../AGENTS.md)).

| Hook                    | Reach for it when                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useCanvasAutoResize`   | A canvas has to follow its container and stay sharp — `ResizeObserver` plus the DPR transform.                                                                                      |
| `useClickOutside`       | An in-place control has to close when the pointer lands elsewhere.                                                                                                                  |
| `usePitState`           | You need the pit and limiter state a widget draws, derived once rather than per widget.                                                                                             |
| `useProximityRadarData` | You are drawing proximity — the shared read of the radar's per-car data.                                                                                                            |
| `useReactiveCanvasLoop` | A canvas widget draws from observables: the reactive draw loop that schedules a frame when what it reads changes.                                                                   |
| `useReactiveDomWrite`   | **The 60 Hz escape hatch** — write a hot value straight to a DOM node or CSS variable without waking React. Read [rendering.md](rendering.md) first.                                |
| `useRowMoveAnimation`   | Rows change order and should slide rather than jump (FLIP; pairs with `MOVE_DURATION_MS`).                                                                                          |
| `useVisibleRowCount`    | A list has to fit however tall the driver stretched the widget.                                                                                                                     |
| `useWidgetSettings`     | **Every widget reads its own settings with this** — it takes the copy from `WidgetIdContext`. `useWidgetInstanceId` is the canvas-side variant, for draw loops a hook cannot enter. |

---

## Design tokens

Never hardcode a hex, an `rem`, a `vw`/`vh`, or a raw pixel size that should
scale. `WidgetContainer` sets `--wfs = currentWidth / designWidth`, and the
functions below are what spend it. All of them are auto-injected — do **not**
import `_variables.scss`, `_functions.scss` or `_widget-tokens.scss` yourself.

| Function        | For                                                                          | Steps                                                                                 |
| --------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `fs($step)`     | font size                                                                    | `xxxs` 10, `xxs` 11, `xs` 12, `sm` 13, `md` 15, `lg` 18, `xl` 22, `xxl` 28, `xxxl` 32 |
| `sp($step)`     | spacing, on a 2px grid                                                       | `xxxs` 2, `xxs` 4, `xs` 6, `sm` 8, `md` 10, `lg` 12, `xl` 16, `xxl` 20                |
| `radius($step)` | corner radius                                                                | `sm` 3, `md` 4, `lg` 6                                                                |
| `ws($px)`       | raw geometry not on a scale — grid columns, canvas and SVG sizes, icon sizes | any px                                                                                |

Reach for `fs()` / `sp()` / `radius()` first; `ws()` only for geometry none of
them covers. **Never** `ws()` for a border — borders stay plain `px`, or they
vanish at small scales.

Colors come from `_widget-tokens.scss` as semantic names — `$widget-text-primary`,
`$widget-text-secondary` and the `$race-*` palette (Tailwind 500/600). A CSS
variable's name must say what it is for, never what color it is. Canvas colors,
which cannot read SCSS, repeat the same palette hexes in JS: the widget
manifests, `GMeterWidget/g-meter-utils.ts`, `utils/weather-utils.ts` and
`utils/colors.ts`.

Fonts: `$font-widget` (`Rajdhani`) for everything, `$font-mono` (`Consolas`) for
figures that must not jitter between frames.
