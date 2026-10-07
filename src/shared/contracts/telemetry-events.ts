import * as TELEMETRY_EVENT_BITS_MODULE from '@shared/contracts/telemetry-event-bits';

/**
 * The high-frequency telemetry a widget asks the backend to send.
 *
 * The backend assembles one `TelemetryBundle` per tick and fills these fields
 * only while at least one widget in the active layout wants them — the mask is
 * `set_active_events`. Names and bits are declared once in Rust
 * (`src-tauri/src/model/telemetry_events.rs`) and generated into
 * `telemetry-event-bits.ts`, whose export names are the names below.
 *
 * What this saves is the *publication*, not the computation: the processor
 * behind a gated field keeps running, so a widget switched back on mid-race
 * finds its history intact. Only the serialization, the IPC hop into every
 * window, the parse and the store write are skipped — which is the whole cost
 * for a raw 60 Hz frame, and the dominant one for a per-car array.
 */
export const TELEMETRY_EVENT_BITS = { ...TELEMETRY_EVENT_BITS_MODULE };

export type TelemetryEventName = keyof typeof TELEMETRY_EVENT_BITS;

export const telemetryEventsToMask = (
  events: Iterable<TelemetryEventName>
): number => {
  let mask = 0;

  for (const event of events) {
    mask |= TELEMETRY_EVENT_BITS[event];
  }

  return mask;
};
