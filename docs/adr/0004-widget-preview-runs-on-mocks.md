# ADR 0004: The widget preview runs on mock builders, not on recorded sessions

**Status:** accepted, 2026-09-14
**Context:** `store/preview/`, the widget preview, the layout editor, Storybook

## Decision

Everything a preview renders against is built by **mock builders**: pure
functions returning one telemetry frame of the types in `bindings.ts`, taking
overrides and knowing nothing about any store. A **scenario** composes builders
on top of the committed **snapshot** and applies the result to an isolated
preview store.

Recorded sessions are not used. The recorded-tape work on
`feat/recorded-session-tapes` — the `.tape` format, the Rust writer, the
recording protocol — is abandoned in place; the branch is kept as the primary
source for the measurements quoted below and nothing from it is merged.

Four rules follow, and they are the decision as much as the choice of mechanism
is:

1. **The preview store is isolated.** A scenario and every builder write only
   into the `RootStore({ skipInit: true })` handed to them. No access to the
   stores the running widgets use, no singletons, no persistence. The one
   channel between the two worlds is the existing one-way mirror of widget
   settings into the preview. Enforced by `no-restricted-imports` over
   `src/store/preview/**`, the way every other layer boundary in this project is
   enforced.
2. **A scenario belongs to the domain of the widget that needs it.** The flag
   widget declares flag scenarios, the fuel widget declares fuel ones. Neither
   declares the other's. A widget with no states of its own declares none.
3. **A scenario exists for a state the driver does not control.** Something that
   arrives on its own and rarely: a flag, an open pit window, a last lap, an
   overheat. A state reachable by a toggle in the widget's settings gets no
   scenario — the toggle already shows it. The scenario answers _with what
   data_; the toggle answers _whether the block is there_.
4. **The preview is a layout tool.** Its question is what the widget looks
   like, because the settings tuned in it become the defaults of the next
   layout. Telemetry consistency is not its question and is not defended here;
   that lives in the running overlay and in the `computations/` tests.

The snapshot survives as one input among the builders rather than as the law: it
carries the sixty-driver list, the track and the session header, which nobody
wants to invent, and it stays inlined (`import.meta.glob`, eager, 71 KB) so
seeding stays synchronous.

## The problem

Recordings give states that are real and mutually consistent — but only the ones
that happened, only when they happened. A preview needs a state **on demand**.

That gap was not theoretical. With the tapes in place, the input trace and the
delta widget had no usable data in them, so hand-written mocks were kept for
Storybook anyway — and the project ended up maintaining two fixture systems,
which is strictly worse than either one alone. The cause is structural, not a
bug in the recorder: the recorder registered for every bit of the demand mask
(`telemetry/tape.rs`), so nothing was gated away. A delta does not exist until a
reference lap does, and a trace buffer fills from a subscription a preview does
not have. Whatever the individual reason, the shape repeats: some widget always
needs a moment the library does not contain, and a mock is written for it.

The second cost is the recording itself. A pit-stop frame requires driving to
the pits, in a live session, with the recorder armed and a scripted protocol
walking the driver through named steps. A pit-stop mock is written in a minute
and is available always.

## Why the tape format was as complex as it was

Recorded whole, the bundles measured **14, 16 and 22 MB per ninety seconds** of
a 61-car field — the synthetic estimate of 3.4 MB/min was wrong because a
synthetic stream holds most fields constant and compresses far better than
telemetry does. A bundle line is ~15 KB and **71 % of it is `driverEntries`**,
three quarters of which are fields that never change, rewritten eighteen times a
second.

Everything else followed from that one number: RFC 7386 merge patches with an
array extension so a line carries only what moved, a writer in Rust and a reader
in TypeScript, `relative` reconstructed rather than stored, `steps[]` in the
manifest so a scenario could name a moment instead of a millisecond that rots on
re-recording, and `flate2` plus a `DecompressionStream` on the other side. The
three committed tapes came to 4.1 MB, fetched as `?url` assets so they stayed
out of the JS bundle — which is why `seedScenario` had to become async and
acquired a seed-chaining hook in the UI.

None of that machinery is wrong. It is the correct answer to a question we have
decided not to ask.

## Storybook uses the same fixtures, and only those

The in-app preview and Storybook draw from one factory. Storybook's own support
code is already thin and already neutral (219 lines under `src/storybook/`,
whose `seed-from-snapshot.ts` is a re-export of the shared seeders), so nothing
is added there. The second fixture set was never in that folder: it is the 25
per-story `seed` functions, 3904 lines of them, assembling frames by hand behind
**43 unsound casts** (`as FuelComputedFrame`, `as Parameters<typeof …>[0]`).
A field added to a frame in `bindings.ts` breaks none of them; they keep drawing
the old shape in silence.

Three consequences:

- A **builder returns a complete frame** — `mockFuel(overrides?:
Partial<FuelComputedFrame>): FuelComputedFrame` — so a story states only its
  difference and the casts disappear. A contract change then breaks one builder
  instead of leaking into seventeen stories.
- A story **takes a scenario as its base and keeps its controls on top**:
  `parameters: { scenario: 'fuel-pit-window' }`, read by
  `defineWidgetStories` the way it already reads `parameters.widgetFrame`,
  seeded before `seed(store, args)` runs. Declared states become stories for
  free; the knobs stay for probing one field at a time.
- `src/storybook/test-data.ts` is folded into builders and deleted. Its
  `driverEntries` is `computeDriverEntries(...)` — a builder living outside the
  factory and reachable only from Storybook, which is the exception the one-set
  rule cannot afford.

That per-story base is also the gap that made `TrackMapWidget` the one story
file to hand-roll its `meta`: `defineWidgetStories` has one `seed` for the whole
`meta`, so state that differs per story had to be pushed through `args` — which
is why a fuel story needs seventeen of them — or the helper had to be abandoned,
which is what `TrackMapWidget` did with a `withStore()` decorator per story.

## What this costs

A mock can describe a frame that no car could produce, and no test will catch
it. Accepted, per rule 4. What is _not_ accepted is a mock that misrepresents
the **layout**: a gap column filled with `+0.1`, or a field of three cars, tells
the truth about physics and lies about the column width the driver is sizing.
The default for a scenario is therefore the **worst realistic case** — the
longest name, the widest gap, the full field, the signed delta — with a second
typical scenario only where the worst case is so unusual that the everyday look
cannot be judged from it.

A scenario is written only when a manifest declares it, and a manifest declares
only ids that exist; one test pins both directions. `PreviewScenarioId` lives in
`src/types/` rather than beside the registry, because manifests are read by the
store layer at import time and a manifest importing the registry would drag the
snapshot and every builder into each chunk that holds a manifest — the remote
screen's browser bundle included.

## When to reopen this

If the preview's question ever changes from "what does this look like" to "is
this data right" — a widget whose whole point is a derived value nobody can eyeball
— the trade in rule 4 is the one to re-read, not the mechanism. And if a
recorded stretch of session is wanted again, the cheap shape was never tried:
a decimated 4 Hz capture written from the frontend as raw JSON Lines, no Rust,
no patch format, no recording protocol, at an estimated 200–400 KB per scenario
and with no motion in the 60 Hz frames.
