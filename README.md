<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-light.svg">
    <img src="docs/assets/logo-dark.svg" alt="Logo" width="200">
  </picture>
</p>

<h1 align="center">Marble Trace</h1>

<p align="center">
  <strong>Open-source iRacing telemetry overlay — beautiful, lightweight, always on top.</strong>
</p>

[![Discord](https://img.shields.io/discord/1342905186041073684?style=flat-square&logo=discord&label=Discord)](https://discord.gg/GVaRsHbjxV) [![Latest release](https://img.shields.io/github/v/release/mvoof/Marble-Trace?style=flat-square)](https://github.com/mvoof/Marble-Trace/releases) [![Downloads](https://img.shields.io/github/downloads/mvoof/Marble-Trace/latest/total?style=flat-square)](https://github.com/mvoof/Marble-Trace/releases) [![Total downloads](https://img.shields.io/github/downloads/mvoof/Marble-Trace/total?style=flat-square)](https://github.com/mvoof/Marble-Trace/releases) [![MIT License](https://img.shields.io/github/license/mvoof/Marble-Trace?style=flat-square)](LICENSE) [![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md) ![Windows only](https://img.shields.io/badge/platform-Windows-blue?style=flat-square) ![Tauri v2](https://img.shields.io/badge/built%20with-Tauri%20v2-purple?style=flat-square)

---

## Why Marble Trace?

Most iRacing overlays are either bloated desktop apps or locked behind subscriptions. **Marble Trace** is different:

- **Zero overhead** — a tiny Rust backend reads telemetry directly via the iRacing SDK; the UI is a transparent frameless window that floats above the sim.
- **Fully modular** — enable only the widgets you need. Each widget lives in its own transparent window and can be repositioned independently.
- **Open source** — MIT licensed. Extend it, theme it, submit a PR.
- **Modern stack** — Tauri v2 + React 19 + MobX + Ant Design. Fast and type-safe.

---

## Widgets

Every widget is independently positioned, resized, and styled — drag it anywhere on screen, scale it to taste, adjust opacity so it never blocks your view. Each one ships with its own set of options: toggle individual data fields, switch layouts, pick colours, set visibility rules. You only see what you actually need, exactly where you want it.

### Speed & RPM

> Your central driving HUD. A circular RPM ring fills up as you rev — it flashes red when you hit the shift point so you never miss a gear. Shows current gear, speed, and an active pit-limiter indicator. Optionally displays tire and brake temperatures per corner so you know exactly when your rubber is up to temperature or overheating.

<p>
  <img src="docs/assets/screenshots/widgets/speed-widget.png" alt="Speed widget — high RPM" >
  <img src="docs/assets/screenshots/widgets/speed-widget-limiter.png" alt="Speed widget — with temps" >
</p>

---

### Input Trace

> Watch your throttle, brake, and clutch inputs scroll in real time. The horizontal trace mode shows a rolling history so you can see exactly where you're trail-braking, blipping, or lifting early. Switch to vertical bars for a clean side-by-side view of all three pedals at once. Great for comparing your technique corner by corner.

<p>
  <img src="docs/assets/screenshots/widgets/input-trace-widget.png" alt="Input Trace — horizontal" width="400">
  <img src="docs/assets/screenshots/widgets/input-trace-vertical.png" alt="Input Trace — vertical bars" >
</p>

---

### Standings

> Full race standings table with multi-class support, SOF, qualify deltas, brand & tire info, and a configurable row budget. All columns visible at once or stripped to essentials.

<p>
  <img src="docs/assets/screenshots/widgets/standings-widget.png" alt="Standings — all columns" >
</p>

---

### Relative

> Relative timing sorted by F2Time — player always centred. Closing/gap trend arrows, lap status (lapping/lapped), class stripes.

<p>
  <img src="docs/assets/screenshots/widgets/relative-widget.png" alt="Relative widget" >
</p>

---

### Track Map

> SVG overhead track map with every car's position, class-coloured dots, P1 / YOU labels, class legend, and sector markers — recorded from your own lap data.

<p>
  <img src="docs/assets/screenshots/widgets/track-map-widget.png" alt="Track Map — with sectors">
</p>

---

### Proximity Radar

> Circular radar centred on your car with a 10 m render range, bumper-to-bumper gap labels, sector masks, and spotter cones.

<p>
  <img src="docs/assets/screenshots/widgets/proximity-radar-widget.png" alt="Proximity Radar — surrounded">
</p>

---

### Radar Bar

> Two slim vertical bars at the screen edges — a quick-glance indicator for side-by-side situations.

<p>
  <img src="docs/assets/screenshots/widgets/radar-bar-widget.png" alt="Radar Bar widget" ">
</p>

---

### Chassis

> Per-corner brake & tire temperatures with optional inboard suspension data and overheat warnings.

<p>
  <img src="docs/assets/screenshots/widgets/chassis-widget.png" alt="Chassis — with inboard" >
  <img src="docs/assets/screenshots/widgets/chassis-overheat.png" alt="Chassis — brake overheat" >
</p>

---

### Fuel

> Lap-by-lap consumption graph, laps remaining, add-fuel suggestion, and tank fill level. Line or bar chart mode.

<p>
  <img src="docs/assets/screenshots/widgets/fuel-widget.png" alt="Fuel — line chart" >
  <img src="docs/assets/screenshots/widgets/fuel-widget-bar.png" alt="Fuel — bar chart" >
  <img src="docs/assets/screenshots/widgets/fuel-widget-low.png" alt="Fuel — low" >
</p>

---

### Lap Delta

> Delta bar vs best / optimal lap with per-sector splits. Vertical or horizontal layout.

<p>
  <img src="docs/assets/screenshots/widgets/lap-delta-widget.png" alt="Lap Delta — vertical with sectors" >
  <img src="docs/assets/screenshots/widgets/lap-delta-horizontal.png" alt="Lap Delta — horizontal" >
</p>

---

### Lap Times

> Current lap, predicted finish time, last, and best lap with deltas. Vertical list or compact horizontal strip.

<p>
  <img src="docs/assets/screenshots/widgets/lap-times-widget.png" alt="Lap Times — vertical with deltas">
  <img src="docs/assets/screenshots/widgets/lap-times-horizontal.png" alt="Lap Times — horizontal">
</p>

---

### Timer

> Session clock with laps-to-go, estimated total laps, and optional real-time clocks.

<p>
  <img src="docs/assets/screenshots/widgets/timer-widget.png" alt="Timer — with laps and position">
</p>

---

### Weather

> Wind direction compass, temperature, humidity, and forecast strip for dynamic weather sessions.

<p>
  <img src="docs/assets/screenshots/widgets/weather-widget.png" alt="Weather — with forecast" ">
</p>

---

### Flags (LED & Flat)

> LED matrix and flat pill-style flag indicators with green, yellow, red, blue, white, checkered, and meatball flag support.

<p>
  <img src="docs/assets/screenshots/widgets/flags-widget.png" alt="Flags LED — green flag" >
  <img src="docs/assets/screenshots/widgets/flat-flags-widget.png" alt="Flat Flags — multiple flags">
</p>

---

### Linear Map

> Compact 1-D track map showing relative car positions along the lap. Horizontal or vertical.

<p>
  <img src="docs/assets/screenshots/widgets/linear-map-horizontal.png" alt="Linear Map — horizontal">
</p>

---

### G-Meter

> Friction circle visualising lateral and longitudinal G-forces in real time. Three display modes — **Trail** (fading line history), **Fading** (decaying envelope), **Peak** (static max-G envelope) — with three colour modes: **Mono**, **Simple** (red brake / green accel / cyan turn), and **Advanced** (smooth gradient blending). Adjustable scale from 2 G to 5 G.

<p>
  <img src="docs/assets/screenshots/g-meter-default.png" alt="G-Meter — fading advanced 4G">
</p>

---

## Prerequisites

| Tool                                                                | Version                     |
| ------------------------------------------------------------------- | --------------------------- |
| [Node.js](https://nodejs.org/)                                      | 18+                         |
| [Rust](https://rustup.rs/)                                          | 1.70+                       |
| [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) | —                           |
| Windows                                                             | iRacing SDK is Windows-only |

## Setup

```bash
npm install
```

## Development

```bash
npm run tauri:dev
```

## Build

```bash
npm run tauri:build:release
```

---

## Architecture overview

```
iRacing SDK
    │  (pitwall crate)
    ▼
Rust service (src-tauri/)
    │  app.emit("iracing://telemetry/*")
    ▼
MobX stores (src/store/)
    │  observer()
    ▼
Widget windows  ←──────── Main window (widget list + settings)
(transparent overlays)
```

- **Telemetry events:** `iracing://telemetry/car-dynamics`, `car-inputs`, `car-status`, `lap-timing`, `session`, `environment`, `car-idx`, plus `iracing://session-info` and `iracing://status`
- **Widget drag mode:** toggle with `F9` (configurable) — green border appears, drag to reposition, position is persisted
- **Unit system:** metric / imperial, toggle in Settings, synced across all windows

---

## Screenshots

You can capture the current state of the overlay or main window using the included scripts. Make sure the app is running in **dev mode** (`npm run tauri:dev`).

- **Via npm:** `npm run screenshot` (captures overlay by default)
- **Via Batch:** `scripts\screenshot.bat [overlay|main]`
- **Output:** Saved to `docs/assets/screenshots/overlay/` (git-ignored).

To update permanent documentation assets, move files from `overlay/` to `widgets/`.

---

### Why pitwall?

Marble Trace uses a custom fork of the [`pitwall` crate](https://crates.io/crates/pitwall) rather than the upstream version. The iRacing SDK exposes session information (track layout, car list, driver names) as a 512 KB YAML document encoded in **Windows-1252 / Latin-1**, not UTF-8. In online races it is very common for driver names to contain accented or special characters — "José Müller", "Kimi Räikkönen", and similar. The upstream crate's internal YAML extraction decodes this buffer with a strict UTF-8 parser (`std::str::from_utf8`). When it hits a byte such as `0xE4` (the `ä` character) outside a valid UTF-8 sequence, the parser returns an error; because the error is swallowed with `.ok()`, the entire session document is silently discarded. The result: every driver with a non-ASCII character in their name causes the whole session to return `null` — no standings, no car list, no track data.

Our fork replaces the strict decoder with a lossy Windows-1252 → UTF-8 conversion so that every byte is always interpreted correctly, driver names are preserved as-is, and the session document is never lost.

---

## Contributing

Contributions, bug reports, and feature requests are very welcome!
Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

---

## License

Distributed under the [MIT License](LICENSE). © 2026 voof
