//! Constants both sides of the IPC boundary have to agree on.
//!
//! Every value here used to exist twice — once in Rust and once in TypeScript,
//! held together by a comment saying "must match". A default that drifts is
//! silent: the widget ships one number, the backend validates against another,
//! and nothing fails until a user notices the wrong answer.
//!
//! So Rust owns them and `src/shared/contracts/generated/backend-constants.ts` is generated from
//! this one list — see [`ts_values`](super::ts_values) for why this is not
//! specta's job and how the declaration and the export stay a single edit.

use crate::contract::ts_values::ts_values;
#[cfg(feature = "dev")]
use crate::contract::ts_values::GENERATED_HEADER;

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

    /// How often the overlays are sent a bundle, in Hz. Each bundle is one
    /// change of the overlay, and every change makes DWM compose a frame on the
    /// GPU the game is drawing on: at 60 Hz that cost iRacing about half its
    /// 1% low; 30 Hz gave most of it back (ADR-0009). The processors run at
    /// the source's own rate whatever this says.
    pub const DEFAULT_OVERLAY_UPDATE_HZ: u32 = 30 => DEFAULT_OVERLAY_UPDATE_HZ;

    /// The source's tick rate the overlay rate divides. A rate is accepted only
    /// when it divides this evenly, so every published tick is a whole number
    /// of source ticks apart.
    pub const SOURCE_TICK_HZ: u32 = 60 => SOURCE_TICK_HZ;

    /// Shown for a car whose class the sim reported without a colour.
    pub const DEFAULT_CLASS_COLOR: &str = "#888888" => DEFAULT_CLASS_COLOR;

    /// The intent and reply key of a question the driver wrote into the voice
    /// pack: `question.<id>`.
    pub const QUESTION_PREFIX: &str = "question." => VOICE_QUESTION_PREFIX;

    /// What a pack's `defaults` names for an intent the engineer asks to say
    /// again with its value, rather than taking one.
    pub const ASK_WHEN_UNSAID: &str = "ask" => VOICE_ASK_WHEN_UNSAID;

    /// A question's reply value read from the sim by the sim's own variable
    /// name: `{sim.PlayerCarMyIncidentCount}`, a whole number.
    pub const SIM_VALUE_PREFIX: &str = "sim." => VOICE_SIM_VALUE_PREFIX;

    /// After a sim value's name: the number to a tenth.
    pub const SIM_SCALE_TENTHS: &str = "tenths" => VOICE_SIM_SCALE_TENTHS;

    /// After a sim value's name: metres per second read as km/h.
    pub const SIM_SCALE_KMH: &str = "kmh" => VOICE_SIM_SCALE_KMH;

    /// After a sim value's name: a share of one read as a percentage.
    pub const SIM_SCALE_PERCENT: &str = "percent" => VOICE_SIM_SCALE_PERCENT;

    /// A step of a question that sends one of the sim's chat macros; its
    /// value is the macro's slot.
    pub const CHAT_MACRO_ACTION: &str = "chat.macro" => VOICE_CHAT_MACRO_ACTION;

    /// The sim's chat macro slots run from 1 to this.
    pub const CHAT_MACRO_COUNT: u32 = 15 => VOICE_CHAT_MACRO_COUNT;

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
        crate::contract::ts_values::assert_exported(
            crate::contract::generated_paths::CONSTANTS_PATH,
            exported_pairs(),
        );
    }
}
