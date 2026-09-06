# Rendering under 60 Hz telemetry

How to write a widget that reads telemetry without turning the overlay into an
allocation pump. Read this before building a widget that declares a hot
`telemetryEvents` field; the rest of the widget rules live in `AGENTS.md`.

## What actually costs

The overlay held 1.0-2.5 GB and cost the game 10-20 FPS. The heap is **not
leaking** — the collector keeps up and live memory saws up and down. The cost is
the rate of allocation: a sampling heap profile of a race puts

- **57%** of all allocation in `jsxDEV` — creating React elements,
- **17%** in the reconciler,
- **under 1%** in parsing the bundle and writing it to stores.

So the price is not the arrival of frames. It is rebuilding element trees on
every arrival, for output that differs by two or three numbers.

## Vocabulary

We use the industry terms, not our own.

| Term                                                                                     | Means                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [wasted render](https://react.dev/reference/react/memo)                                  | a render that produces the same output                                                                                                                                   |
| [lifting content up](https://overreacted.io/before-you-memo/)                            | creating a static subtree in a parent that does not re-render, and passing it down as `children`                                                                         |
| [dereference late](https://github.com/mobxjs/mobx/blob/main/docs/react-optimizations.md) | pass observable objects around; read their properties in the component that renders them                                                                                 |
| imperative updates                                                                       | writing a changing value straight to the DOM or a canvas, outside React's render                                                                                         |
| hot field                                                                                | a bundle field that changes on every tick: `carDynamics`, `carInputs`, `carPositions`, `lapDelta`, and the heavy per-car frames `driverEntries`, `relative`, `proximity` |

## Splitting components smaller does not fix this

The intuition is that a small component with unchanged input does not re-render,
so finer components cost less. Half of that is true and the other half is the
bug.

When a parent renders, it calls `jsx()` for **every** child and allocates an
element object for each. `observer` includes `memo`, so React may then skip
executing the child's body — but the element is already allocated. Splitting a
component into twelve smaller ones leaves twelve element allocations per frame
and adds twelve bailout comparisons.

The question is never how small the pieces are. It is **who creates the element
on each frame**.

## The rule

> A component that reads a hot field returns as little as possible. Everything
> that does not change while that field does is created somewhere that does not
> re-render, and reaches the reactive part as `children`.

Concretely: split the widget into a shell that reads the hot field and does one
thing with it, and a body that reads nothing hot. The body is created once by a
parent that never re-renders; React sees the same element object and skips the
whole subtree. This is _lifting content up_ — see "Before You memo()".

A ring of twelve static ticks that rotates with the car is the canonical case:
the ticks never change, only the transform on the group around them does.

## The escape hatch, for 60 Hz only

When the changing value is a single number per frame — an angle, an offset, a
level — React does not need to be involved at all. The value goes to the DOM
through **`useReactiveDomWrite`** (`ui/hooks/useReactiveDomWrite.ts`): a MobX
`autorun` reads the observables synchronously and the write is coalesced into
the next animation frame. It mirrors `useReactiveCanvasLoop`, its sibling, which
already does exactly this for canvas widgets. What to write — a style property,
a custom property, an attribute — is the caller's decision, not the
primitive's.

Use it only for hot fields, and only through that primitive. A hand-rolled
`useRef` plus `requestAnimationFrame` is the same idea without the review
signal: the shared primitive is what `grep` finds and what tells a reviewer the
bypass was deliberate.

The compass ring is the worked example. `RotatingRing` writes one custom
property, `--compass-yaw`; the group rotates by it and the cardinal labels
counter-rotate by it in CSS, so one write per frame turns the whole ring and
keeps the letters upright, and React renders nothing.

At 10 Hz the escape hatch is not the answer — the shell/body split is. Those
frames carry per-car arrays, and their problem is width, not rate.

## How this is enforced

Two layers, deliberately different in kind.

**Static — `oxlint`, with `react-doctor` as an occasional sweep.** `oxlint` runs
on every commit and every pull request and is the blocking half; it carries
`react-hooks/rules-of-hooks`, which is the one class of React defect here worth
stopping a commit for. `react-doctor` is deliberately **not** in continuous
integration — it is an agent skill, run by hand when a widget has been reworked,
for the two things `oxlint` has no rule for: discarded MobX disposers and the
accessibility checks outside its `jsx-a11y` set. `docs/agents/react-doctor.md`
has the reasoning.

It knows nothing about which of our fields are hot, so **it cannot check the
rule above** — and the budgets cannot check what it checks. Neither layer
covers the other; a green scan says nothing about a render budget. Which of its
rules are switched off, and why each one was, is `doctor.config.mjs`.

**Runtime — render budgets.** One `*.perf.test.tsx` beside each widget whose
manifest declares a hot field. The test replays a fixed burst of frames through
a real store and asserts how many times each component woke. `npm run test:perf`
locally; in continuous integration it is the _Run Render Budgets_ step of the
frontend job in `.github/workflows/reusable-quality.yml`, which fails the build
when a component goes over. It stays out of `npm test` and out of the pre-commit
hook — it needs a real browser, which those must not wait for.

## Measuring

Counting is done with MobX's own `spy`: `observer` creates a reaction per
component, and `spy` reports a `reaction` event with that component's debug name
every time it fires. This measures **wake-ups**, not committed renders — which
is the better number here, because the rule is about what an observable wakes.

Attribution needs a name, and `observer(() => …)` has none: the arrow is an
argument, so nothing infers one, and every such component lands in the same
bucket. **A component under a budget is declared as
`observer(function Name() { … })`** — the one place this repo's arrow-function
rule does not apply, because the name is the measurement. The harness refuses to
report rather than mis-attribute if it finds an anonymous one.

`spy` is a no-op in production builds and is dropped by minification, so the
measurement can never reach the app bundle. The flip side: perf tests must run
against a non-production MobX build. If a test config ever sets
`NODE_ENV=production`, every counter silently reads zero and every budget
"passes".

The tests run in vitest browser mode (Playwright), not jsdom: the escape hatch
writes CSS custom properties inside `requestAnimationFrame`, and in jsdom both
are fake, so testing it there proves nothing.

The harness is `src/perf/render-budget.tsx`, imported by nothing the
application bundles. Fixtures live in the test file. Seeding reuses what the app
already ships in
`store/preview/` (the layout editor imports it, so it is in the bundle by
right); nothing that exists only for tests may be added there.

They are their own command, `npm run test:perf`, with its own config
(`vitest.perf.config.ts`). They are deliberately not part of `npm test` and not
part of `pre-commit`, which stays fast; on a pull request they are the blocking
_Run Render Budgets_ step of the frontend job, which the existing path filters
skip when nothing on the frontend changed.

## Budgets

Budgets are absolute numbers in one table in the test, not a generated baseline
file. A baseline turns every honest change into a "regenerate the snapshot"
ritual and lets drift accumulate unseen.

Raising a number is allowed and takes one line of justification beside it in the
same commit. That line is where a reviewer asks whether the render is actually
minimal.

Widgets that predate the rule carry their current number **and** the target,
marked as debt:

```
WindArrow   target 1   current 60   debt
```

Recording the current value alone would quietly make sixty wake-ups the norm.

### How a target is chosen

A budget is what the component costs today. A target is what it should cost once
the rule is applied to it, and it is read off the burst rather than argued:

- **one wake per burst** for a component whose output follows a value that
  changes every tick — the burst moves it sixty times, and the rule says one
  element, written through the bypass or lifted out of the re-rendering parent,
  is enough;
- **one wake per row** for a component drawn once per car, where each row's own
  numbers really do change;
- **zero** for a component that renders nothing the burst changed. It wakes
  because it reads a frame, not a field — the class ticket 07 is about.

Targets are the basis of a follow-up ticket, not a second contract: only the
budget column fails the build.

The table has to name **everything that woke**, not only what someone thought
worth pinning: a component missing from it would have no budget at all, which is
the hole a new sub-component would otherwise fall straight through. A wake-up
attributed to a name the table does not list fails the test on its own.

### Where the budgets stand

Every widget whose manifest declares a hot field has one `*.perf.test.tsx` in
its folder, and the table lives in that file. Coverage is derived from the
manifests by `src/perf/budget-coverage.perf.test.tsx`, so a widget that starts
declaring a hot field without a perf test fails the suite.

| widget            | worst row today     | state                                     |
| ----------------- | ------------------- | ----------------------------------------- |
| `close-battle`    | `BattleRow` 2       | within budget                             |
| `g-meter`         | —                   | nothing wakes: it is all canvas           |
| `coach`           | `InfoRow` 1         | within budget                             |
| `engine-panel`    | `AbsCell` 0         | within budget                             |
| `input-trace`     | `Bar` 3             | within budget                             |
| `invisible-dash`  | `EngineCluster` 1   | within budget                             |
| `pit-service`     | `PitApproachRail` 1 | within budget                             |
| `proximity-radar` | `RadarScope` 0      | within budget                             |
| `race-dash`       | `RingBadge` 1       | within budget                             |
| `radar-bar`       | `RadarBar` 2        | within budget                             |
| `relative`        | `DriverRow` 3       | within budget                             |
| `relative-map`    | `LinearMap` 1       | within budget                             |
| `rpm-lights`      | `RpmLightsWidget` 0 | within budget                             |
| `sector-matrix`   | `SectorGrid` 1      | within budget                             |
| `standings`       | `DriverRow` 5       | within budget                             |
| `timer`           | `TimerFooter` 1     | within budget                             |
| `track-map`       | `TrackMapSvg` 1     | within budget                             |
| `weather`         | `WindArrow` 1       | within budget; the ring beside it is at 0 |

Every widget above has had the rule applied. The four list-shaped ones —
`relative`, `relative-map`, `standings` and `track-map` — were the same shape of
problem in all four: a row or a dot was handed the per-car entry as a prop, and
that entry object is replaced on every frame. They were fixed by the
identity/position split rather than by another bypass: `CarIdentity`
(`src/types/car-identity.ts`) is the entry without its four moving fields, the
store exposes it as a `computed.struct` list that stays the same object for a
whole lap, and the numbers that do move are read by `carIdx` inside the
reaction that writes them.

## The overlay's own number

A per-widget budget cannot say whether the work paid off. It answers "does this
component wake for something it does not draw", and the sum of them answers
less than it looks: the sanctioned bypass takes a widget's wake-ups to zero
while its per-frame work carries on outside React, so optimising the sum
optimises the counter.

`src/perf/overlay-cost.perf.test.tsx` is the number that does not move that way.
It mounts every hot widget together, replays the same one-second burst, and
counts two things — observer wake-ups, and DOM mutations under a
`MutationObserver`, which a bypass write lands in exactly as a React commit
does.

|                   | before this work | after     |
| ----------------- | ---------------- | --------- |
| observer wake-ups | 2049             | 4-6       |
| DOM mutations     | 4518             | 1200-2200 |

Bytes allocated is the number all of this was really about, and it is not in the
file: `performance.memory` in headless Chromium is bucketed coarsely enough that
a whole burst reads as a zero delta. The mutation count stands in for it, since
producing those mutations is what most of that allocation was being spent on.
The two are asserted very differently — wake-ups tightly, mutations as a coarse
tripwire — and the test says why.

### Attribution needs named components

The counter keys on the component's debug name, so every `observer` in a widget
is declared as `observer(function Name() { … })`. That is the one place the
repo's arrow-function rule does not apply, and the harness refuses to report
rather than mis-attribute if it finds an anonymous one.

## Per-field observables: asked and answered

Telemetry frames are stored as whole `observable.ref` values, so a component
reading one field of a frame wakes on every change to that frame — including
fields it never reads. Splitting frames into per-field observables (with or
without a delta on the wire) was the obvious fix for that class.

It was measured and it is **not** being done:
`docs/adr/0001-per-field-telemetry-observables.md` has the numbers and the
reasoning. Two thirds of the wake-ups in a burst produce a single rendering, but
none of them turn out to be a component reading the wrong field — they are a
canvas the markup cannot see, a value the widget's own formatting rounds away,
or a 10 Hz field the burst advances at 60 Hz and writes past the quantization
and repeat-suppression that already drop it on the wire.

`src/perf/wake-up-classification.perf.test.tsx` is that measurement, kept
runnable and pinned so the record cannot rot. What was left after it was the
debt column above, not the store's shape — and that column is now empty.
