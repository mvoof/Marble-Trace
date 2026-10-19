# ADR 0010: The overlay window covers its whole monitor

**Status:** accepted, 2026-10-19
**Context:** in-game frame captures with PresentMon on an iRacing replay, the
method of [`docs/perf-methodology.md`](../perf-methodology.md);
`app/sync/overlay-windows.ts`

## Decision

An overlay window keeps the size of its monitor. It is **not** shrunk to the
bounding box of the widgets on it. A monitor with no widget gets no window at
all (`overlayMonitorNames`), which stays the one size optimisation.

## Why

A transparent window costs the game a little for its area alone, even when
nothing in it changes. A bbox window would remove that cost, but it removes
nothing that a driver feels, and real layouts leave nothing to shrink.

Measured on one machine (Ryzen 7 7700, RTX 4070, 3440×1440 @ 164 Hz),
iRacing borderless windowed (an overlay cannot draw over exclusive full
screen), one replay point, 90 s per run, three runs per variant.
In each pair the same widgets are packed in the monitor's top-left corner and
draw the same pixels. Only the window differs: the whole monitor, or shrunk
from that corner to the widgets plus 16 px.

| widgets              | window             | avg FPS     | 1% low      | stutters/min |
| -------------------- | ------------------ | ----------- | ----------- | ------------ |
| none (references)    | —                  | 154.4–155.1 | 130.3–132.0 | 0            |
| `lap-log`, static    | monitor            | 153.3–153.5 | 130.3–130.8 | 0–0.7        |
| `lap-log`, static    | 236 × 276 (~1 %)   | 154.8–155.1 | 131.4–132.1 | 0–1.3        |
| `input-trace`, 30 Hz | monitor            | 150.2–150.7 | 122.8–123.3 | 9–21         |
| `input-trace`, 30 Hz | 536 × 136          | 152.5–154.7 | 125.0–127.1 | 5–11         |
| 8 widgets¹, 30 Hz    | monitor            | 145.8–146.4 | 65.7–67.0   | 48–65        |
| 8 widgets¹, 30 Hz    | 1846 × 704 (~26 %) | 147.3–147.7 | 67.3–67.5²  | 50–52²       |

¹ standings, relative, track-map, fuel, input-trace, delta, proximity-radar,
race-dash. ² One more run read 112 / 12, the bimodal outlier the method warns of.

- The window's area costs **1–2 % of the average FPS** (+1.5 to +2.8 FPS,
  ~0.1 ms of GPU per frame), consistently: the ranges never overlap.
- It does **not** move the 1% low or the stutters. Those follow the rate of
  overlay changes (ADR-0009), and a smaller window changes just as often.
- The game stayed in **Hardware: Independent Flip** in every run, whatever the
  window size.
- A window is a rectangle. Layouts put widgets along the edges and in the
  corners, so their bounding box is the monitor: the layouts these runs were
  taken on cover 98–104 % of their monitors. For them a bbox window would be
  the window there is now.

## Considered and rejected

- **One window per monitor, sized to the widgets' bounding box**, recomputed
  when a widget is switched on or off, moved or resized, or the layout
  changes, and widened back to the monitor in drag mode. It gains ~1–2 % average
  FPS only on layouts that keep their widgets in one area. It costs a window
  resize on every edit, which rebuilds the WebView2 surfaces, and an offset
  between a widget's frame and its place in the window, which every
  main ↔ overlay position has to carry.
- **Several windows per monitor, one per cluster of widgets.** More DWM layers
  compete for the GPU's few multi-plane-overlay planes, which risks dropping
  the game from Independent Flip into Composed: Flip. Two windows that update
  out of step also change the overlay more often per second, and that is the
  cost ADR-0009 measured.

## Consequences

- The overlay keeps paying ~1–2 % of the average FPS for its area. Reopen this
  if layouts that keep their widgets in one area become common, or if a
  capture on another GPU shows a larger cost. A threshold such as
  `bboxArea / monitorArea < 0.5` would be the place to start.
- The experiment can be repeated with `npm run perf:game -- run … --pack` (the
  monitor) against the same run with `--shrink-overlay` added (the shrunk
  window). `--pack` lays the widgets out from the monitor's top-left corner
  for the run only; `--shrink-overlay` shrinks the overlay window to them with
  `SetWindowPos` and prints the rect it got. See the header of
  `scripts/perf-game.mjs`.
