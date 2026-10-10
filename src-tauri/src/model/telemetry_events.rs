//! The bits of the telemetry mask a window sends with `set_active_events`.
//!
//! The frontend composes the mask from the `telemetryEvents` each widget
//! manifest declares; the emitter leaves an unrequested field out of the
//! bundle. Both halves read this one list: `src/shared/contracts/telemetry-event-bits.ts`
//! is generated from it, and its export names *are* the names a manifest
//! writes — the bundle field each bit gates, in the bundle's own camelCase —
//! so the frontend derives `TelemetryEventName` from the module instead of
//! restating either the names or the bits.

use crate::model::ts_values::ts_values;
#[cfg(feature = "dev")]
use crate::model::ts_values::GENERATED_HEADER;

ts_values! {
    export_telemetry_event_bits => GENERATED_HEADER;

    /// The player car's 60 Hz motion: G forces, yaw, velocities.
    pub const EVENT_CAR_DYNAMICS: u32 = 1 << 0 => carDynamics;

    /// The player's 60 Hz pedal, wheel and gear inputs.
    pub const EVENT_CAR_INPUTS: u32 = 1 << 1 => carInputs;

    /// The 60 Hz live delta to the chosen reference lap.
    pub const EVENT_LAP_DELTA: u32 = 1 << 2 => lapDelta;

    /// Every car's 60 Hz position on the lap.
    pub const EVENT_CAR_POSITIONS: u32 = 1 << 3 => carPositions;

    /// The heavy per-car standings rows. Like the two below, computed on every
    /// due tick no matter what — their processors carry state — but a frame
    /// nobody reads is left out of the bundle rather than serialized, shipped
    /// to every window and remote screen, parsed there and written into a store.
    pub const EVENT_DRIVER_ENTRIES: u32 = 1 << 4 => driverEntries;

    /// The cars just ahead of and behind the player, by track position.
    pub const EVENT_RELATIVE: u32 = 1 << 5 => relative;

    /// Cars alongside the player, for the radars.
    pub const EVENT_PROXIMITY: u32 = 1 << 6 => proximity;

    /// Where on the lap cars are stopped or off track — the warning zones the
    /// track map draws.
    pub const EVENT_INCIDENTS: u32 = 1 << 7 => incidents;

    /// The driving coach's call against the reference lap. Computed on every
    /// tick so the latch survives the coach being switched off and on again.
    pub const EVENT_COACH: u32 = 1 << 8 => coach;

    /// The player's incidents and the Safety Rating estimate. A small frame,
    /// but the corner count moves on every tick while driving; computed all
    /// session so a widget switched on mid-race reads the whole distance.
    pub const EVENT_SAFETY_RATING: u32 = 1 << 9 => safetyRating;
}

#[cfg(all(test, feature = "dev"))]
mod tests {
    use super::*;

    #[test]
    fn the_checked_in_file_carries_every_bit() {
        crate::model::ts_values::assert_exported(
            crate::bindings::TELEMETRY_EVENT_BITS_PATH,
            exported_pairs(),
        );
    }
}
