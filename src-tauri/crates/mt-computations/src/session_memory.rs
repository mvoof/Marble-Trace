//! What the event in progress has measured that the sim cannot give back: the
//! fuel and lap history, the personal best's sectors, the pit stop count and
//! the driver's choice to switch pit auto mode off. Kept across a restart of the
//! app or the sim, keyed by the event it belongs to.
//!
//! Each processor's part carries the session number the processor tracks, so a
//! session that moved on while nobody watched is thrown away by the same check
//! that resets the processor live. The personal best and the auto mode switch
//! have none: they outlive a session change live as well.

use serde::{Deserialize, Serialize};

use crate::strategy::fuel::FuelMemory;
use crate::strategy::pit_stops::PitStopsMemory;
use crate::timing::lap_delta::PersonalBestMemory;
use crate::timing::lap_log::LapLogMemory;

/// The sim's first lap with a number that means anything. Below it a resumed
/// processor is looking at a car not yet in the world, not at a restart.
pub const FIRST_LAP: i32 = 1;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct SessionMemory {
    /// The event (`WeekendInfo.SubSessionID`) this belongs to.
    pub sub_session_id: i32,
    pub fuel: FuelMemory,
    pub lap_log: LapLogMemory,
    pub personal_best: PersonalBestMemory,
    pub pit_stops: PitStopsMemory,
    pub pit_auto_suspended: bool,
}

impl SessionMemory {
    /// Nothing worth keeping. A blank memory is never written: it would replace
    /// the file before the connection has read it back.
    pub fn is_blank(&self) -> bool {
        self.fuel.laps.is_empty()
            && self.lap_log.history.is_empty()
            && self.personal_best.lap_time.is_none()
            && self.pit_stops.stops == 0
            && self.pit_stops.last_service_s.is_none()
            && !self.pit_auto_suspended
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ProcessorRegistry;

    #[test]
    fn processors_that_have_seen_nothing_remember_nothing() {
        let memory = ProcessorRegistry::default().session_memory(500);

        assert_eq!(memory.sub_session_id, 500);
        assert!(memory.is_blank());
    }

    #[test]
    fn a_switched_off_auto_mode_alone_is_worth_keeping() {
        let memory = SessionMemory {
            pit_auto_suspended: true,
            ..SessionMemory::default()
        };

        assert!(!memory.is_blank());
    }
}
