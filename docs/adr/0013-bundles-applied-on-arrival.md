# ADR 0013: A bundle is applied when it arrives, not coalesced per frame

**Status:** accepted, 2026-11-13
**Context:** `docs/perf-baseline.md` → "bundles per display frame"

## Decision

The overlay applies every `sim://telemetry/bundle` in the event handler that
receives it (`SimStore.subscribeBundle` → `applyTelemetryBundle`). It does not
hold the latest payload and apply it once in the next `requestAnimationFrame`.

The DOM side already coalesces: `useReactiveDomWrite` and
`useReactiveCanvasLoop` flush in the next animation frame, and a newer run
replaces the writes an older one scheduled. Two bundles in one frame cost two
store updates and one DOM write per call site.

## Why

The alternative was to keep only the newest payload and apply it once per frame.
Measured on the largest layouts (32 widgets, 60 Hz, 165 Hz display), it has
nothing to coalesce:

- In steady state no frame received more than one bundle. Not at 30 Hz, not at
  60 Hz, not with 32 widgets.
- A queue forms only behind a stall. With the main thread blocked for 100 ms
  twice a second, the 5–6 bundles that arrived meanwhile ran back to back before
  the next frame: 14 % of applies were for bundles nobody saw, about
  1.5–5 ms on top of a stall that already cost 100.
- Apply is 0.2–0.6 ms at p50 and 1.2 ms at p99. Parsing the payload, measured as
  `JSON.parse` of the same text, stays at or under 0.2 ms even for the 20 KB
  full bundle. ADR-0006 stands.

Coalescing is not free to get right. A bundle carries only what changed, the
slow tiers ride on a published tick (ADR-0009), and `inputSamples` holds every
source tick since the last publication. A dropped bundle would therefore have to
be merged field by field, and its samples concatenated, or the overlay loses
data. That is a permanent correctness risk for a few milliseconds after a stall
that is already a dropped frame.

## Consequences

- Nothing changes in the code. The overlay clock (ADR-0009) stays the only
  limit on how often the stores change.
- Revisit if stalls become routine: a perf run whose `frames over budget` stays
  well above zero on a normal layout, or apply p99 approaching a frame (≈ 6 ms
  at 165 Hz).
