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

**Static — `react-doctor`.** Generic React anti-patterns, architecture,
accessibility. Available as an agent skill while code is written; running it in
`diff` mode on pull requests is still to be set up. Either way it knows nothing
about which of our fields are hot, so it cannot check the rule above.

**Runtime — render budgets.** One `*.perf.test.tsx` beside each widget whose
manifest declares a hot field. The test replays a fixed burst of frames through
a real store and asserts how many times each component woke.

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
part of `pre-commit`, which stays fast; making them a blocking pull-request step
filtered to frontend changes is still to do.

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

## Not done yet, on purpose

Telemetry frames are stored as whole `observable.ref` values, so a component
reading one field of a frame wakes on every change to that frame — including
fields it never reads. Splitting frames into per-field observables (with or
without a delta on the wire) would fix that class, but per-field proxies over
63-car arrays may cost more than they save.

That decision waits for data, and the counter above produces it for free: a
component of that class shows far more wake-ups than its own field has changes.
Nothing on the wire gets touched before those numbers exist.
