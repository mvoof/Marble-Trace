/**
 * The high-frequency telemetry a widget asks the backend to send.
 *
 * The backend assembles one `TelemetryBundle` per tick and fills these fields
 * only while at least one widget in the active layout wants them — the mask is
 * `set_active_events`, and the bit values must match
 * `src-tauri/src/telemetry/state.rs`.
 *
 * What this saves is the *publication*, not the computation: the processor
 * behind a gated field keeps running, so a widget switched back on mid-race
 * finds its history intact. Only the serialization, the IPC hop into every
 * window, the parse and the store write are skipped — which is the whole cost
 * for a raw 60 Hz frame, and the dominant one for a per-car array.
 */
export type TelemetryEventName =
  | 'carDynamics'
  | 'carInputs'
  | 'lapDelta'
  | 'carPositions'
  | 'driverEntries'
  | 'relative'
  | 'proximity'
  | 'incidents';

export const TELEMETRY_EVENT_BITS: Record<TelemetryEventName, number> = {
  carDynamics: 1 << 0,
  carInputs: 1 << 1,
  lapDelta: 1 << 2,
  carPositions: 1 << 3,
  driverEntries: 1 << 4,
  relative: 1 << 5,
  proximity: 1 << 6,
  incidents: 1 << 7,
};

export const telemetryEventsToMask = (
  events: Iterable<TelemetryEventName>
): number => {
  let mask = 0;

  for (const event of events) {
    mask |= TELEMETRY_EVENT_BITS[event];
  }

  return mask;
};
