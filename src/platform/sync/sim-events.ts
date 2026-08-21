/**
 * Event names the backend emits, re-exported from the generated contract.
 *
 * The names themselves are declared in `src-tauri/src/model/events.rs` and
 * written out to `@utils/backend-events` — this module is the frontend's door
 * onto them, plus the handful of names that never cross the boundary.
 */
export {
  SIM_TELEMETRY_BUNDLE,
  SIM_TELEMETRY_SLOW,
  SIM_SESSION,
  SIM_WEATHER,
  SIM_STATUS,
  SIM_PERF,
  SIM_DISCONNECTED,
  SIM_CAPABILITIES,
  SIM_TRACK_SHAPE,
  SIM_REFERENCE_LAP_UPDATED,
  CHAT_MESSAGE,
  CHAT_PRESENCE,
  CHAT_DELETION,
  INPUT_DEVICES_EVENT,
  INPUT_BUTTON_EVENT,
  REMOTE_DEVICE_EVENT,
} from '@utils/backend-events';

/** Frontend-only: the overlay asks the track map to drop its recording. */
export const TRACK_MAP_CLEAR = 'track-map:clear';
