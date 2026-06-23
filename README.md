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

<div align="center">
  
[![Latest release](https://img.shields.io/github/v/release/mvoof/Marble-Trace?style=flat-square)](https://github.com/mvoof/Marble-Trace/releases) [![MIT License](https://img.shields.io/github/license/mvoof/Marble-Trace?style=flat-square)](LICENSE) [![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md) ![Windows only](https://img.shields.io/badge/platform-Windows-blue?style=flat-square) ![Tauri v2](https://img.shields.io/badge/built%20with-Tauri%20v2-purple?style=flat-square)

</div>

<p align="center">
  Marble Trace is actively developed — new widgets, fixes, and features land regularly.<br>
  Got a bug, an idea, or just want to share your setup? Join the community on Discord.
</p>
<p align="center">
  <a href="https://discord.gg/GVaRsHbjxV">
    <img src="https://discordapp.com/api/guilds/1342905186041073684/widget.png?style=shield" alt="Discord">
  </a>
</p>

---

## Why Marble Trace?

Most iRacing overlays are either bloated desktop apps or locked behind subscriptions. **Marble Trace** is different:

- **Zero overhead** — a tiny Rust backend reads telemetry directly via the iRacing SDK; the UI is a transparent frameless window that floats above the sim.
- **Fully modular** — enable only the widgets you need. Each widget lives in its own transparent window and can be repositioned independently.
- **Open source** — MIT licensed. Extend it, theme it, submit a PR.
- **Modern stack** — Tauri v2 + React 19 + MobX + Ant Design. Fast and type-safe.

---

## Featured Widgets

- [Speed & RPM](#speed--rpm) — HUD with gear, RPM ring & tire temps
- [Input Trace](#input-trace) — Real-time pedal history or bars
- [Standings](#standings) — Race table with deltas & multi-class
- [Relative](#relative) — F3-style timing with closing trends
- [Track Map](#track-map) — SVG map with live positions & sectors
- [Proximity Radar](#proximity-radar) — 360° awareness & bumper gaps
- [Radar Bar](#radar-bar) — Edge indicators for side-by-side
- [Chassis](#chassis) — Brake temps & suspension data
- [Fuel](#fuel) — Consumption graph & pit-stop math
- [Delta HUD](#delta-hud) — Live delta vs any reference lap with lap flash card
- [Sector Matrix](#sector-matrix) — Per-sector times, delta chips & predicted finish
- [Lap Log](#lap-log) — Rolling lap history table with delta column
- [Timer](#timer) — Session clock & laps-to-go
- [Weather](#weather) — Live conditions & dynamic forecast
- [Flags (LED/Flat)](#flags-led--flat) — Matrix and pill-style indicators
- [Relative Map](#relative-map) — 1-D relative track position
- [G-Meter](#g-meter) — Lateral & longitudinal friction circle

---

## Widgets

Every widget is independently positioned, resized, and styled — drag it anywhere on screen, scale it to taste, adjust opacity so it never blocks your view. Each one ships with its own set of options: toggle individual data fields, switch layouts, pick colours, set visibility rules. You only see what you actually need, exactly where you want it.

### Speed & RPM

Your central driving HUD. A circular RPM ring fills up as you rev — it flashes red when you hit the shift point so you never miss a gear. Shows current gear, speed, and an active pit-limiter indicator. Optionally displays tire and brake temperatures per corner so you know exactly when your rubber is up to temperature or overheating.

![Speed widget — high RPM](docs/assets/screenshots/widgets/speed-widget.png)

---

### Input Trace

Watch your throttle, brake, and clutch inputs scroll in real time. The horizontal trace mode shows a rolling history so you can see exactly where you're trail-braking, blipping, or lifting early. Switch to vertical bars for a clean side-by-side view of all three pedals at once. Great for comparing your technique corner by corner.

![Input Trace — horizontal](docs/assets/screenshots/widgets/input-trace-widget.png)

---

### Standings

Full race standings table with multi-class support, SOF, qualify deltas, brand & tire info, and a configurable row budget. All columns visible at once or stripped to essentials. Switch between the combined leaderboard and a single-class group view with its own SOF and field size.

![Standings — all columns](docs/assets/screenshots/widgets/standings-widget.png)
![Standings — single-class group](docs/assets/screenshots/widgets/standings-widget-group.png)

---

### Relative

Relative timing sorted by F2Time — player always centred. Closing/gap trend arrows, lap status (lapping/lapped), class stripes.

![Relative widget](docs/assets/screenshots/widgets/relative-widget.png)

---

### Track Map

SVG overhead track map with every car's position, class-coloured dots, P1 / YOU labels, class legend, and sector markers — recorded from your own lap data.

![Track Map — with sectors](docs/assets/screenshots/widgets/track-map-widget.png)

---

### Proximity Radar

Circular radar centred on your car with a 10 m render range, bumper-to-bumper gap labels, sector masks, and spotter cones.

![Proximity Radar — surrounded](docs/assets/screenshots/widgets/proximity-radar-widget.png)

---

### Radar Bar

Two slim vertical bars at the screen edges — a quick-glance indicator for side-by-side situations.

![Radar Bar widget](docs/assets/screenshots/widgets/radar-bar-widget.png)

---

### Chassis

Per-corner brake & tire temperatures with optional inboard suspension data and overheat warnings.

![Chassis — brake overheat](docs/assets/screenshots/widgets/chassis-overheat.png)

---

### Fuel

Lap-by-lap consumption graph, laps remaining, add-fuel suggestion, and tank fill level. Line or bar chart mode.

- **LAPS LEFT:** Current driving range in laps based on fuel in the tank.
- **EST. FINISH:** Projected fuel balance (surplus or deficit in liters) at the end of the race.
- **PIT WARNING:** Appears when you need to refuel, showing exactly how many liters to add (including a +1 lap buffer) to reach the finish.

![Fuel full preview](docs/assets/screenshots/widgets/fuel-widget.png)
![Fuel — small view](docs/assets/screenshots/widgets/fuel-widget-small.png)

---

### Delta HUD

Live delta bar that compares your current lap against a configurable reference — your personal best (PB), your personal optimal (PO, best sectors combined), session best (SB), session optimal (SO), or the previous lap in the session (SL). The bar fills green when you are ahead and red when behind. When you cross the finish line a lap flash card appears (top, bottom, left, or right of the widget) showing the completed lap time and its delta. Card display duration is adjustable.

![Lap Delta — vertical with sectors](docs/assets/screenshots/widgets/lap-delta-widget.png)

---

### Sector Matrix

Grid of sector times for the current lap with color-coded delta chips (green = faster than personal best, red = slower). Header shows live delta and predicted finish time. Reference for the live delta and predicted time is configurable; sector chips always compare vs your personal best.

![Sector Matrix — live lap](docs/assets/screenshots/widgets/sector-matrix.png)

---

### Lap Log

Rolling history of your completed laps — lap number, lap time, and delta vs personal best for each row. The live row at the top shows the current lap's real-time delta using the configured reference (PB / PO / SB / SO / SL). Historical rows always compare vs personal best.

![Lap Log — recent laps](docs/assets/screenshots/widgets/lap-history.png)

---

### Timer

Session clock with laps-to-go, estimated total laps, and optional real-time clocks.

![Timer — with laps and position](docs/assets/screenshots/widgets/timer-widget.png)

---

### Weather

Wind direction compass, temperature, humidity, and forecast strip for dynamic weather sessions.

![Weather — with forecast](docs/assets/screenshots/widgets/weather-widget.png)

---

### Flags (LED & Flat)

LED matrix and flat pill-style flag indicators with green, yellow, red, blue, white, checkered, and meatball flag support.

![Flags LED — green flag](docs/assets/screenshots/widgets/flags-widget.png)
![Flat Flags — multiple flags](docs/assets/screenshots/widgets/flat-flags-widget.png)

---

### Relative Map

Compact 1-D track map showing relative car positions along the lap. Horizontal or vertical.

![Linear Map — horizontal](docs/assets/screenshots/widgets/linear-map-horizontal.png)

---

### G-Meter

Friction circle visualising lateral and longitudinal G-forces in real time. Three display modes — **Trail** (fading line history), **Fading** (decaying envelope), **Peak** (static max-G envelope) — with three colour modes: **Mono**, **Simple** (red brake / green accel / cyan turn), and **Advanced** (smooth gradient blending). Adjustable scale from 2 G to 5 G.

![G-Meter — friction circle](docs/assets/screenshots/widgets/g-meter-default.png)

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

## Screenshots

Capture the current state of the overlay or main window using the included scripts. The app must be running in **dev mode** (`npm run tauri:dev`).

```
node scripts/screenshot.mjs [windowId] [--out-dir <dir>] [--crop]
scripts\screenshot.bat      [windowId] [--out-dir <dir>] [--crop]
```

| Argument          | Default                            | Description                                                           |
| ----------------- | ---------------------------------- | --------------------------------------------------------------------- |
| `windowId`        | `overlay`                          | Window to capture: `overlay` or `main`                                |
| `--out-dir <dir>` | `docs/assets/screenshots/overlay/` | Directory where the full screenshot is saved                          |
| `--crop`          | off                                | Also crop each visible widget into `<out-dir>/widgets/<widgetId>.png` |

**Examples:**

```bash
# Full overlay screenshot → docs/assets/screenshots/overlay/screenshot-<ts>.png
npm run screenshot

# Crop all visible widgets into docs/assets/screenshots/overlay/widgets/
npm run screenshot -- --crop

# Custom output directory + crop (note the -- separator required by npm)
npm run screenshot -- --out-dir docs/assets/screenshots/widgets --crop

# Or call node directly (no -- needed)
node scripts/screenshot.mjs overlay --out-dir docs/assets/screenshots/widgets --crop
```

The `docs/assets/screenshots/overlay/` directory is git-ignored. To update permanent documentation assets, copy files from there into `docs/assets/screenshots/widgets/`.

---

### Why pitwall?

Marble Trace uses a custom fork of the [`pitwall` crate](https://crates.io/crates/pitwall) rather than the upstream version. The iRacing SDK exposes session information (track layout, car list, driver names) as a 512 KB YAML document encoded in **Windows-1252 / Latin-1**, not UTF-8. In online races it is very common for driver names to contain accented or special characters — "José Müller", "Kimi Räikkönen", and similar. The upstream crate's internal YAML extraction decodes this buffer with a strict UTF-8 parser (`std::str::from_utf8`). When it hits a byte such as `0xE4` (the `ä` character) outside a valid UTF-8 sequence, the parser returns an error; because the error is swallowed with `.ok()`, the entire session document is silently discarded. The result: every driver with a non-ASCII character in their name causes the whole session to return `null` — no standings, no car list, no track data.

Our fork replaces the strict decoder with a lossy Windows-1252 → UTF-8 conversion so that every byte is always interpreted correctly, driver names are preserved as-is, and the session document is never lost.

---

## Analytics & Privacy

Marble Trace uses [Aptabase](https://github.com/aptabase/aptabase) — an open-source, privacy-first analytics platform. No personal data is collected. The following anonymous events are tracked:

| Event         | When                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| `app_started` | On every launch — includes primary monitor resolution, scale factor, system locale and DPI |

Aptabase automatically captures: OS, app version, country (from IP), and locale. No user IDs, no file paths, no telemetry data from iRacing.

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
