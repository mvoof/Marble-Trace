//! Constants both sides of the IPC boundary have to agree on.
//!
//! Every value here used to exist twice — once in Rust and once in TypeScript,
//! held together by a comment saying "must match". A default that drifts is
//! silent: the widget ships one number, the backend validates against another,
//! and nothing fails until a user notices the wrong answer.
//!
//! So Rust owns them and `src/utils/backend-constants.ts` is generated from
//! this one list — see [`ts_values`](super::ts_values) for why this is not
//! specta's job and how the declaration and the export stay a single edit.

use crate::model::ts_values::ts_values;
#[cfg(feature = "dev")]
use crate::model::ts_values::GENERATED_HEADER;

ts_values! {
    export_constants => GENERATED_HEADER;

    /// Laps of fuel left at which the Fuel widget starts warning.
    pub const DEFAULT_PIT_WARNING_LAPS: f32 = 3.0 => DEFAULT_PIT_WARNING_LAPS;

    /// `fuelAvgWindow` value meaning "average every recorded lap of the session".
    pub const DEFAULT_FUEL_AVG_WINDOW: usize = 0 => FUEL_AVG_WINDOW_ALL_LAPS;

    /// Longest fuel averaging window the backend accepts, matching
    /// `MAX_LAP_FUEL_HISTORY`. The settings slider enforces the same ceiling.
    pub const MAX_FUEL_AVG_WINDOW: u32 = 100 => FUEL_AVG_WINDOW_MAX;

    /// One lap of cushion: the pit window closes a lap before the tank runs
    /// dry, and the widget stops naming a window at the same moment.
    pub const PIT_WINDOW_END_BUFFER_LAPS: f32 = 1.0 => PIT_WINDOW_END_BUFFER_LAPS;

    /// Car length in meters used by the radar widgets and by the backend's gap
    /// maths until the user picks one for the car they are driving.
    pub const DEFAULT_CAR_LENGTH_M: f32 = 4.4 => DEFAULT_CAR_LENGTH_M;

    /// Shown for a car whose class the sim reported without a colour.
    pub const DEFAULT_CLASS_COLOR: &str = "#888888" => DEFAULT_CLASS_COLOR;

    /// Distance buckets a reference lap is recorded into: index `i` covers
    /// `lap_dist_pct` in `[i / count, (i+1) / count)`. The coach records the lap
    /// in progress on the same grid to compare the two traces bucket for
    /// bucket, so a change here re-buckets both sides at once or neither.
    pub const REFERENCE_LAP_BUCKET_COUNT: usize = 1000 => REFERENCE_LAP_BUCKET_COUNT;
}

#[cfg(all(test, feature = "dev"))]
mod tests {
    use super::*;

    #[test]
    fn the_checked_in_file_carries_every_constant() {
        crate::model::ts_values::assert_exported(crate::bindings::CONSTANTS_PATH, exported_pairs());
    }
}
