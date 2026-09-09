# React Doctor

The **static** layer of the rendering work: generic React and JavaScript
anti-patterns, architecture, accessibility. `docs/rendering.md` covers the
hot/cold rendering rule this tool cannot check.

## Running it

```bash
npx react-doctor@latest --verbose --scope changed   # after touching React code
npx react-doctor@latest --verbose                   # the whole codebase
```

It is also installed as an agent skill (`react-doctor`, invoked as `/doctor`),
which is the half that acts earliest — while the code is being written.

**It does not run in continuous integration, on purpose.** It was tried there
and removed: across one full review of this codebase the only finding worth
blocking on was a conditional hook, and `oxlint` reports that itself once
`react-hooks/rules-of-hooks` is enabled — which it now is, in the lint step that
already runs on every commit and every pull request. On the branch that added
the workflow, `--scope changed` found nothing at all. What was left was a runner
and a token that can write to the pull request, spent on a third-party binary,
for two rules that fire about as often as someone remembers to run it by hand.

So it stays a **sweep**, not a gate: run it deliberately, when a widget has been
reworked or a store has grown, and read all of it.

## What it uniquely catches

Two things nothing else here does: `mobx-reaction-disposer-discarded`, which
found `RadarWidgetStore` leaking two reactions per preview store, and the
accessibility rules `oxlint`'s `jsx-a11y` set leaves out — an icon-only button
with no accessible name went unreported by every other check.

## What it cannot do

**It cannot enforce this project's rendering rule.** It does not know which
telemetry fields are hot, so it cannot tell a component that wakes sixty times a
second from one that never does. There is no runtime check for that rule at
all — see `docs/rendering.md` — so a component can be textbook React and still
rebuild a tree sixty times a second, and a clean scan says nothing about it.

## Which rules are off

`doctor.config.mjs`, with the reason beside each one. They fall into three
groups: rules whose defaults contradict this repo's own layering (which
`.oxlintrc.json` enforces), micro-optimisations on cold paths, and structural
preferences this project decides for itself.

Three rules about _behaviour_ are left on although each fires once today, on
code that explains itself in a comment beside it. A second occurrence of one of
them is worth a fresh look rather than a config change.
