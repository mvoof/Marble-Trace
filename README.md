# Marble Trace

iRacing telemetry overlay built with Tauri v2 + React 19 + Rust + MobX.

<p align="center">
  <img src="https://github.com/mvoof/Marble-Trace/blob/main/docs/assets/app-icon.png" width="100px" alt="Marble Trace">
</p>

## Architecture

- **Main window** — standard window with Ant Design UI for managing widgets and settings
- **Widget windows** — transparent, always-on-top, frameless overlay windows rendered over the game
- **Telemetry flow:** Rust (pitwall stream) → `app.emit("telemetry-frame")` → all windows listen via `@tauri-apps/api/event`

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/)
- Windows (iRacing SDK is Windows-only)

## Setup

```bash
npm install
```

## Development

```bash
npm run tauri dev
```

## Build

```bash
npm run tauri:build:release
```

## Adding a New Widget

1. Create a component in `src/components/widgets/YourWidget/`
2. Register it in `src/pages/WidgetPage/WidgetPage.tsx` → `WIDGET_MAP`
3. Add a default config entry in `src/store/widget-settings.store.ts` → `DEFAULT_WIDGETS`
4. The widget receives telemetry via `telemetryStore` (MobX observable, import from `src/store/telemetry.store.ts`)

## Available Telemetry Fields

| Field                       | Type              | Description                               |
| --------------------------- | ----------------- | ----------------------------------------- |
| `speed`                     | `number`          | Speed in m/s                              |
| `rpm`                       | `number`          | Engine RPM                                |
| `gear`                      | `number`          | Current gear (-1=R, 0=N, 1-8)             |
| `throttle`                  | `number`          | Throttle position (0.0–1.0)               |
| `brake`                     | `number`          | Brake position (0.0–1.0)                  |
| `steering_wheel_angle`      | `number`          | Steering angle in radians                 |
| `fuel_level`                | `number`          | Fuel level in liters                      |
| `oil_temp`                  | `number`          | Oil temperature °C                        |
| `water_temp`                | `number`          | Water temperature °C                      |
| `lap_current_lap_time`      | `number`          | Current lap time in seconds               |
| `clutch`                    | `number \| null`  | Clutch position (0.0–1.0)                 |
| `lap`                       | `number \| null`  | Current lap number                        |
| `lap_dist`                  | `number \| null`  | Distance traveled on current lap (meters) |
| `lap_dist_pct`              | `number \| null`  | Lap completion percentage (0.0–1.0)       |
| `lap_last_lap_time`         | `number \| null`  | Last completed lap time (seconds)         |
| `lap_best_lap_time`         | `number \| null`  | Best lap time in session (seconds)        |
| `session_time`              | `number \| null`  | Session elapsed time (seconds)            |
| `session_time_remain`       | `number \| null`  | Session remaining time (seconds)          |
| `session_state`             | `number \| null`  | Session state code                        |
| `session_flags`             | `number \| null`  | Session flags bitmask                     |
| `session_num`               | `number \| null`  | Session number                            |
| `velocity_x`                | `number \| null`  | Lateral velocity (m/s)                    |
| `velocity_y`                | `number \| null`  | Vertical velocity (m/s)                   |
| `velocity_z`                | `number \| null`  | Longitudinal velocity (m/s)               |
| `yaw_rate`                  | `number \| null`  | Yaw rate (rad/s)                          |
| `pitch`                     | `number \| null`  | Pitch angle (rad)                         |
| `roll`                      | `number \| null`  | Roll angle (rad)                          |
| `lat_accel`                 | `number \| null`  | Lateral acceleration (m/s²)               |
| `long_accel`                | `number \| null`  | Longitudinal acceleration (m/s²)          |
| `fuel_level_pct`            | `number \| null`  | Fuel level percentage (0.0–1.0)           |
| `fuel_use_per_hour`         | `number \| null`  | Fuel consumption rate (L/h)               |
| `oil_press`                 | `number \| null`  | Oil pressure (bar)                        |
| `voltage`                   | `number \| null`  | Battery voltage (V)                       |
| `player_car_position`       | `number \| null`  | Overall race position                     |
| `player_car_class_position` | `number \| null`  | In-class race position                    |
| `car_left_right`            | `number \| null`  | Spotter car-left-right indicator          |
| `on_pit_road`               | `boolean \| null` | Whether car is on pit road                |
| `is_on_track`               | `boolean \| null` | Whether car is on track                   |

## License

MIT
