// Generated from Rust by `ts_values!` (src-tauri/src/model/ts_values.rs), the
// value generator that runs alongside specta's type export. Specta writes
// `bindings.ts` and only handles types; these are values, so they come from
// here. Edit the Rust declaration, not this file.

/**
 * Laps of fuel left at which the Fuel widget starts warning.
 */
export const DEFAULT_PIT_WARNING_LAPS = 3.0;

/**
 * `fuelAvgWindow` value meaning "average every recorded lap of the session".
 */
export const FUEL_AVG_WINDOW_ALL_LAPS = 0;

/**
 * Longest fuel averaging window the backend accepts, matching
 * `MAX_LAP_FUEL_HISTORY`. The settings slider enforces the same ceiling.
 */
export const FUEL_AVG_WINDOW_MAX = 100;

/**
 * One lap of cushion: the pit window closes a lap before the tank runs
 * dry, and the widget stops naming a window at the same moment.
 */
export const PIT_WINDOW_END_BUFFER_LAPS = 1.0;

/**
 * Car length in meters used by the radar widgets and by the backend's gap
 * maths until the user picks one for the car they are driving.
 */
export const DEFAULT_CAR_LENGTH_M = 4.4;

/**
 * Shown for a car whose class the sim reported without a colour.
 */
export const DEFAULT_CLASS_COLOR = '#888888';

/**
 * Distance buckets a reference lap is recorded into: index `i` covers
 * `lap_dist_pct` in `[i / count, (i+1) / count)`. The coach records the lap
 * in progress on the same grid to compare the two traces bucket for
 * bucket, so a change here re-buckets both sides at once or neither.
 */
export const REFERENCE_LAP_BUCKET_COUNT = 1000;
