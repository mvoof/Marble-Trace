# ADR 0006: Telemetry stays JSON

**Status:** accepted, 2026-10-05
**Context:** the architecture rework's transport gate (ticket 12),
`docs/perf-baseline.md` → "transport gate (ticket 12)"

## Decision

The telemetry bundle keeps travelling as JSON, through Tauri events to the
windows and through the WebSocket hub to remote screens, typed by specta. No
binary encoding, no `ipc::Channel`, no struct-of-arrays layout, and no frame
scheduler built to consume one.

## Why

The gate was set before measuring: parse plus store writes at most 0.8 ms on
the worst tick and at most 5 % of allocation. Measured on the largest layout in
use (one overlay, one stream screen), after static driver data left the wire,
it failed both: 1.0–1.2 ms on the stream screen, 17.6 % of the overlay's
allocation.

The gate's rule said a failure starts a binary prototype. That rule is
overridden here, on the absolute numbers rather than the ratio:

- The transport's whole cost on the overlay is **1.65 MiB/s** of 9.4 — the
  stores-only A/B, where nearly all of it is the payload literal. A transport
  that cost nothing would take at most that off.
- The other ~7 MiB/s is MobX reactions and React, which the encoding does not
  touch. Single sources inside it are larger than the parse: `carIdentityOf`
  2.05 MiB/s, the track map's SVG 1.89 MiB/s.
- A binary format costs a hand-declared byte layout, a generated TS decoder,
  a second encoding path for remote screens, and the loss of specta's types
  on the hottest data — permanent weight for a bounded, minority gain.

The 0.8 ms on the stream screen is parse **with** reactions on a page that
mounts twelve widgets; store writes alone stay at 0.1 ms on the overlay.

## Consequences

- Tickets 13 (binary hot frames) and 14 (frame scheduler) are dropped.
- Allocation work goes where the bytes are: the reaction and render side
  (ticket 26), measured against the same baseline.
- Revisit only if the transport's absolute share grows — a stores-only run
  well above today's 1.65 MiB/s, or the parse becoming the largest single
  bucket in a widgets run.
