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

The autorun follows the **element**, not the component. Most of these
components return `null` until what they draw is on screen — a spotter call, a
driver row, a setting switched on — so the ref is attached several commits after
the component mounts, and a primitive that looked for the element once would
never write anything for the rest of that mount. Attaching starts the run,
detaching disposes it.

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

## The hot/cold split

Treat the overlay as two contours, not one tree that happens to update fast in
places:

- **Cold contour (React, 1-4 Hz and below).** Everything React actually
  reconciles: widget shells, mounting, settings, modals, the rare event
  (session change, a pit stop). This is where `observer` and ordinary
  props/state belong.
- **Hot contour (DOM/canvas, 10-60 Hz).** Data that changes every tick or close
  to it never becomes a React prop deep in a tree. It goes straight to a DOM
  node through `useReactiveDomWrite`, or straight to a canvas through
  `useReactiveCanvasLoop` — both bypass the reconciler entirely.

A widget is built by deciding, per hot field, which contour it belongs to
**before** writing the component — not by writing it plainly and then
memoising the result. See "The rule" and "The escape hatch" above for how each
contour is implemented; this split is the vocabulary for talking about the
decision, not a new mechanism.

## How this is enforced

**Static — `oxlint`, with `react-doctor` as an occasional sweep.** `oxlint` runs
on every commit and every pull request and is the blocking check; it carries
`react-hooks/rules-of-hooks`, which is the one class of React defect here worth
stopping a commit for. `react-doctor` is deliberately **not** in continuous
integration — it is an agent skill, run by hand when a widget has been reworked,
for the two things `oxlint` has no rule for: discarded MobX disposers and the
accessibility checks outside its `jsx-a11y` set. `docs/agents/react-doctor.md`
has the reasoning.

**There is no runtime check for the rendering rule.** Neither `oxlint` nor
`react-doctor` knows which bundle fields are hot, so neither can tell a
component that wakes sixty times a second from one that never does. This repo
previously carried a `*.perf.test.tsx` beside each hot widget, replaying a
fixed telemetry burst through a real store and asserting how many times each
component woke — it was retired: it needed a real browser in CI (Playwright),
and the two tests that measured the whole overlay together
(`overlay-cost`, `wake-up-classification`) proved sensitive enough to GitHub
Actions' runner variance to fail on unchanged code, while every per-widget
budget passed. The signal-to-noise on the aggregate tests did not justify
keeping a Playwright stage in every pull request.

**What replaces it is review, not a runner.** A PR touching a widget that
declares a hot field is expected to name, in review, which contour each hot
field is on and why — the same information the retired harness would have
measured. `AGENTS.md` and `docs/widget-authoring.md` carry the rule for anyone
(human or AI) opening such a file. This is a real trade: a regression in a hot
widget's allocation behavior can land and go unnoticed until someone profiles
the overlay again, rather than failing a build. See "The overlay's own number"
below for the shape of that regression if it needs re-measuring by hand.

## Measuring, by hand

If a widget's cost needs proving out again — a suspected regression, a new hot
widget, a profiling session — the technique that was automated is still worth
doing manually:

- **Wake-ups** are counted with MobX's own `spy`: `observer` creates a reaction
  per component, and `spy` reports a `reaction` event with that component's
  debug name every time it fires. This counts **wake-ups**, not committed
  renders — the better number, because the rule is about what an observable
  wakes. Attribution needs a name, so a component being profiled this way
  should be declared `observer(function Name() { … })` for the duration, not as
  an anonymous arrow.
- **DOM mutations** are counted with a `MutationObserver` around the mounted
  tree — a bypass write lands here exactly as a React commit does, so it is the
  number that does not go to zero just because wake-ups did.
- Bytes allocated is what this is really about, and it resists measurement in
  headless Chromium (`performance.memory` buckets too coarsely for a one-second
  burst to show a delta) — a Chrome DevTools heap profile against the real app
  in `tauri:dev` is the reliable way to see it directly; the sampling profile
  quoted at the top of this document ("57% in `jsxDEV`") came from exactly that.

Before this work landed, mounting every hot widget together and replaying a
one-second burst measured roughly 2049 observer wake-ups and 4518 DOM
mutations; after applying the rule to every hot widget, that fell to 4-6
wake-ups and 1200-2200 DOM mutations. Those numbers are a historical baseline
for comparison, not an asserted budget.

## Per-field observables: asked and answered

Telemetry frames are stored as whole `observable.ref` values, so a component
reading one field of a frame wakes on every change to that frame — including
fields it never reads. Splitting frames into per-field observables (with or
without a delta on the wire) was the obvious fix for that class.

It was measured and it is **not** being done:
`docs/adr/0001-per-field-telemetry-observables.md` has the numbers and the
reasoning. Two thirds of the wake-ups in a burst produced a single rendering,
but none of them turned out to be a component reading the wrong field — they
were a canvas the markup cannot see, a value the widget's own formatting
rounds away, or a 10 Hz field the burst advanced at 60 Hz and wrote past the
quantization and repeat-suppression that already drop it on the wire. See the
ADR for the full record.
