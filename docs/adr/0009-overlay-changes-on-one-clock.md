# ADR 0009: The overlay changes on one clock, 30 Hz by default

**Status:** accepted, 2026-10-12
**Context:** in-game frame captures with PresentMon on an iRacing replay;
the method and every run are in [`docs/perf-methodology.md`](../perf-methodology.md)

## Decision

The overlay is allowed to change at most once per **publication tick**, and
nothing on it animates between ticks.

- The emitter publishes a bundle on every Nth source tick:
  `appSettings.overlayUpdateHz`, one of 60 / 30 / 20 / 15, **30 by default**
  (`DEFAULT_OVERLAY_UPDATE_HZ`, `set_overlay_update_hz`). The processors still
  run on every tick; only assembling and sending the bundle waits.
- The slower tiers (10 / 4 / 1 Hz) keep their rates but are only ever due on a
  published tick, so a cold field rides in the same bundle as the hot ones
  instead of changing the overlay between two of them.
- A widget sets a value that moves with telemetry **without a CSS transition
  or animation**. A transition stays only on a change of state — a light
  switching on, the pit limiter engaging — and each one is listed with its
  reason in `src/widgets/widget-transitions.test.ts`, which fails on any other.

## Why

Every change of the overlay makes DWM compose a frame on the GPU the game is
drawing on. A static overlay costs the game almost nothing; a changing one
costs it in proportion to how often it changes, whatever is drawn and however
small. Measured on one machine (Ryzen 7 7700, RTX 4070, 3440×1440 @ 164 Hz,
the game GPU-bound at ~90 %), iRacing full screen, one replay segment, 90 s
per run:

| overlay                                       | avg FPS         | 1% low (p99)   | stutters/min  |
| --------------------------------------------- | --------------- | -------------- | ------------- |
| none                                          | 154–155         | 122–125        | 0.7–1.3       |
| one static widget                             | 148.5           | 115            | 4             |
| one 240 px compass turned at 60 / 30 / 15 Hz  | 142 / 146 / 147 | 69 / 100 / 110 | 147 / 32 / 22 |
| 29 widgets, 60 Hz, transitions (before)       | 136.7           | 69             | 85            |
| 29 widgets, 30 Hz, transitions kept           | 137.4           | 68             | 117           |
| 29 widgets, 60 Hz, no transitions             | 137.3           | 73             | 77            |
| **29 widgets, 30 Hz, no transitions (after)** | **141.4–142.3** | **96–99**      | **25–35**     |

- One widget updating at 60 Hz cost as much as all 29: the cost is the number
  of overlay changes per second, not the amount drawn. Writing through SVG, a
  composited `transform`, a canvas or text made no difference at one rate.
- The relation to the rate is not linear: 60 → 30 Hz removed most of the
  stutter, 30 → 15 Hz little more.
- Neither half works alone. A transition re-run by each bundle never stops, so
  the overlay changed at the monitor's 164 Hz at any publication rate — 30 Hz
  with transitions measured the same as 60 Hz. Without transitions the clock
  decides.
- The game kept presenting through **Hardware: Independent Flip** in every
  run, with `SyncInterval 0` and tearing allowed: the overlay did not push it
  into DWM composition or break VRR. Its own GPU time per frame grew instead
  (+0.4–0.7 ms), which is what pushed frames past the next vblank.

## Considered and rejected

- **A rate per widget, each on its own timer.** Two widgets at 30 Hz on
  alternate ticks change the overlay 60 times a second. A per-widget rate is
  only safe as a divisor of the one clock.
- **Cheaper drawing** (canvas instead of SVG, composited transforms, removing
  `will-change`). Measured equal at the same rate; the cost is the change, not
  its kind.
- **Chromium / WebView2 flags** (`disable-direct-composition`, the ANGLE
  backend). Not needed once the overlay stops changing between ticks; left
  untested.
- **An overlay injected into the game** (as RTSS or a sim plugin does), which
  bypasses DWM entirely. A renderer per sim inside another process; out of
  proportion once a transparent window costs ~8 % average FPS.

## Consequences

- Hot widgets move at 30 Hz: track-map dots, radar cars, the input trace and
  the compass step instead of gliding, and a readout lags by up to 33 ms. The
  user can choose 60 Hz back in Settings → Overlay.
- Bars and fills jump to their value instead of easing into it.
- The input trace would receive only the published ticks — half of them at
  30 Hz — so the bundle carries the ticks in between as `inputSamples`, which
  only the trace asks for, and its history keeps every one. The coach needs no
  such field: it records by distance, and its position arrives on the 10 Hz
  tier anyway.
- An alert that flashes (flags, pit approach, punctures, the shift light) does
  so through `useBlink`, a timer that writes the DOM only when its step changes,
  never through an infinite CSS animation — which, even as `steps()`, has the
  browser build a frame on every display refresh while it runs. Pulses that
  used to ease are two-state blinks now. The flashes are not aligned with the
  bundles: a 2 Hz blink adds four overlay changes a second, against the 165 an
  animation cost. `widgets/widget-transitions.test.ts` fails on an infinite
  animation in a widget or a shared component.
- The cost depends on how little headroom the GPU has. With the game capped
  well below the refresh rate it may vanish; the numbers above are the
  GPU-bound case, the one that matters.
- On a system without multi-plane overlays the game can fall back to
  **Composed: Flip**, where a transparent window does force composition and
  costs more. `docs/perf-methodology.md` checks for it.
