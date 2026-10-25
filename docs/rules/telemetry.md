# Telemetry rules

Bundle rates, the slow slice, demand gating, quantization and the inspector. Background: `docs/architecture.md` → `mt-telemetry`, ADR-0009.

## Telemetry Bundle rates

_Held by: test (the scheduler's rates and that a timed tier is never due off a published tick — `mt-telemetry/src/delivery/scheduler.rs`); review (the rest)._

The processors run on every source tick (~60 Hz). A bundle is **published** on
every Nth tick — the overlay clock, `appSettings.overlayUpdateHz` (60 / 30 / 20 /
15, default 30, `set_overlay_update_hz`) — and the slower tiers are only ever due
on a published tick (ADR-0009). Every bundle is one change of the overlay, and
every change costs the game a composed frame: never publish off the clock.

| Hz    | Fields                                                                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| clock | `carDynamics`, `carInputs`, `inputSamples`, `carPositions`, `lapDelta`, `pitTarget`, `coach`, `trackRecording`, `proximity`                                    |
| 10    | `carIdx`, `chassis`, `lapTiming`, `driverEntries`, `relative`, `incidents`, `paceCar`                                                                          |
| 4     | `carStatus`, `fuel`, `pitStops`, `lapLog`, `pitService`, `pitAuto`, `safetyRating`                                                                             |
| 1     | `session`, `environment`                                                                                                                                       |
| async | `sim://session`, `sim://weather`, `sim://status`, `sim://disconnected`, `sim://capabilities`, `sim://perf`, `sim://track-shape`, `sim://reference-lap/updated` |

Event names are declared in `src-tauri/crates/mt-model/src/contract/events.rs` and generated into
`src/shared/contracts/generated/backend-events.ts`; `src/shared/api/sim-events.ts` re-exports them
and adds the few that never cross the boundary. Never use telemetry
`sessionTime` for 60 Hz integration — use `performance.now()`.

## The slow slice — telemetry for windows off the bundle

_Held by: review — nothing stops main from subscribing to the bundle; only the roots decide who calls `subscribeBundle`._

Only windows that **draw widgets** subscribe to `sim://telemetry/bundle`
(`SimStore.subscribeBundle`); Tauri delivers an event solely to webviews holding
a listener, so the main window pays nothing for 60 Hz it does not render.

Main takes `sim://telemetry/slow` instead — the player's `car_status` at 4 Hz,
for the layout auto-switch, which reads `is_on_track`. That is all it decides
on: the hotkeys and the pit orders run on the telemetry thread's own frames, so
nothing in main reads the sim to act on it. A new consumer in main adds its
frame to `TelemetrySlowBundle` in `emitter.rs` and to
`SimStore.subscribeSlowBundle`, not a subscription to the bundle.

**Every pit order goes out from the telemetry thread.** Auto mode decides there
(`mt-computations/src/strategy/pit_auto.rs`, stepped at 4 Hz in `emitter.rs`); a manual one —
a key, or a click through `run_pit_action` — is a `PitAction` the thread
resolves against the frame of the tick that drains it
(`mt-computations/src/strategy/pit_actions.rs`), claiming its half of the stop from auto mode
before the broadcast leaves. Main pushes the rules — `appSettings.pitAuto*`,
the fuel key step in liters, whether the widget is in the active layout — with
`set_pit_strategy`; the auto mode plate is `toggle_pit_auto`. The widget learns
every order, manual or automatic, from `pitAuto.ordersSent` on the bundle.
Orders are not sent while a tape is replayed.

## Demand-gated bundle fields

_Held by: test (a manifest declaring an event the backend does not gate, or one twice — `widget-catalog.test.ts`); review (declaring every gated field a widget reads, and nothing it does not)._

Eleven bundle fields are filled **only while a widget asks for them**: the four
60 Hz frames (`carDynamics`, `carInputs`, `carPositions`, `lapDelta`), the
two heavy per-car frames on the 10 Hz tier (`driverEntries`, `relative`),
the per-car `proximity` on the clock tier, `incidents`, the coach's call (`coach`, clock tier), the Safety
Rating estimate (`safetyRating`, 4 Hz) and the input trace's per-tick inputs
(`inputSamples` — every source tick since the last publication, so a trace
keeps the sim's rate on any overlay clock). Everything else is always sent. Every
widget declares its appetite in its own `manifest.ts`:

```ts
export const G_METER_MANIFEST: WidgetManifest = {
  id: 'g-meter',
  telemetryEvents: ['carDynamics'],
  ...
};
```

`SimStore` (`updateOwnActiveEvents`) unions the declarations of every **enabled** widget
in the active layout and sends the mask to the backend
(`set_active_events`); `emitter.rs` leaves an unrequested field out of the
bundle. The names and their bit values are declared once, in
`src-tauri/crates/mt-model/src/contract/telemetry_events.rs` (`ts_values!`), and generated into
`src/shared/contracts/generated/telemetry-event-bits.ts`; `src/shared/contracts/telemetry-events.ts` derives
`TelemetryEventName` from it. A new gated field is one line there.

**Gate the publication, never the computation.** A processor that carries state
— fuel, lap log, pit stops, standings, the reference lap — keeps running whether
anyone is watching or not, so a widget switched back on mid-race finds its
history intact. Only fields that are a snapshot of the current tick may be
skipped at the source. What the mask saves is the serialization, the IPC hop into
every window (and every remote screen), the parse and the store write — which is
the whole cost of a raw 60 Hz frame.

A widget that reads a gated field without declaring it renders empty; one that
declares a field it never reads costs every other window the traffic. Both are
why the declaration sits next to the widget instead of in a list elsewhere.

## Quantization and repeat suppression

_Held by: review (the precision chosen, the `PartialEq` on a suppressed frame)._

`mt-telemetry/src/delivery/quantize.rs` rounds the per-car frames to the precision a widget draws
(positions 4 dp, gaps 2 dp, lap times 3 dp, distances and speeds 2 dp; the coach's call to the step it is drawn at), and
`mt-telemetry/src/delivery/publications.rs` then drops any frame identical to the last one
published. The order is load-bearing: raw floats are never bit-identical two
ticks running, so without rounding first nothing would ever compare equal.

- **Round at publication, never on the way in.** `mt-computations` always sees raw
  values — a processor that integrates or compares against a threshold would
  accumulate the error.
- Both run **after** the mask, so a gated-away field is never recorded as sent.
- The 1 Hz tier forces a full bundle, so a reloaded window or a freshly opened
  remote screen paints within a second; a disconnect clears the record.
- `car_dynamics` / `car_inputs` are left alone on purpose — nothing to suppress,
  and they feed coach and input-trace smoothing.

Adding a field to the rounding means picking a precision at least one decimal
finer than the `toFixed` that renders it, and adding a `PartialEq` to its frame.

## Telemetry inspector

_Held by: review._

Its own settings section (Maintenance group), in dev builds only — `tauri:dev`
and `tauri:build:dev`, whose frontend is built in the `devtools` mode
(`pages/settings/dev-tools.ts`); a release build shows neither it nor the
snapshot export. Shows four streams as a lazy
tree. Two are the sim's own data, untouched: every iRacing variable under its
own name with the sim's type, unit and description (kerb's `telemetry_snapshot` /
`var_list_snapshot`, copied one to one in `mt-source/src/raw.rs`), and the session
YAML as written — as text, and as a tree in the document's order. Two are ours,
and the panel says so: the live `SourceFrame` (a superset of the bundle — every
field the adapter produced, including ones no widget receives) and the parsed
session snapshot read straight from `session.sessionInfo`.

Rows are built by `features/telemetry-inspector/inspector-tree.ts`, which descends only into
branches the user opened. Arrays are expanded by index rather than printed
inline — a 63-car array behind an ellipsis answers nothing — and capped per row
with a "show all". Switching to the session **stops** the telemetry feed: that
stream arrives on `sim://session`, which this window already receives.

**It pulls, it never subscribes.** The settings window is deliberately off the
telemetry bundle; an inspector listening for it would undo that. The feed is
`set_inspector_active` plus `get_inspector_frame` / `get_inspector_raw_values`,
polled at 4 Hz only while the panel is mounted, and the backend keeps no frame
while it is closed; the variable list (`get_raw_var_meta`) is read once per
connection, the YAML (`get_raw_session`) once per session change. The snapshot
export uses the same feed for one frame and writes the raw data beside the
adapted frames (`raw` in `TelemetrySnapshot`).

| Layer                                 | File                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| feed state, one-shot capture          | `features/telemetry-inspector/telemetry-inspector.store.ts`                                           |
| row building, filtering, array paging | `features/telemetry-inspector/inspector-tree.ts`                                                      |
| commands                              | `src-tauri/src/commands/telemetry.rs`, frame stored in `mt-telemetry/src/emitter.rs` on the 4 Hz tier |
| UI                                    | `features/telemetry-inspector/TelemetryInspectorSection/`                                             |

---
