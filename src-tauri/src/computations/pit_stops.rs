use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU32, Ordering};

use pitwall::SessionInfo;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::iracing::frames::AllFieldsFrame;

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PitStopsFrame {
    pub player_stops: u32,
}

/// Shared state for pit stop tracking.
pub struct PitStopState {
    /// Player pit stop counter for the current session.
    pub count: AtomicU32,
    /// Whether the player was on pit road on the previous frame.
    pub was_on_pit_road: AtomicBool,
    /// Session number tracked for pit stop reset.
    pub tracked_session_num: AtomicI32,
}

impl Default for PitStopState {
    fn default() -> Self {
        Self {
            count: AtomicU32::new(0),
            was_on_pit_road: AtomicBool::new(false),
            tracked_session_num: AtomicI32::new(-1),
        }
    }
}

pub fn compute(
    frame: &AllFieldsFrame,
    session: &SessionInfo,
    state: &PitStopState,
) -> Option<PitStopsFrame> {
    let player_idx = session
        .driver_info
        .as_ref()
        .and_then(|di| di.driver_car_idx)
        .unwrap_or(-1);

    if player_idx < 0 {
        return None;
    }

    let current_session_num = frame.session_num.unwrap_or(-1);
    let tracked_session = state.tracked_session_num.load(Ordering::Relaxed);

    if current_session_num != tracked_session {
        state
            .tracked_session_num
            .store(current_session_num, Ordering::Relaxed);
        state.count.store(0, Ordering::Relaxed);
        state.was_on_pit_road.store(false, Ordering::Relaxed);
    }

    let on_pit = frame
        .car_idx_on_pit_road
        .get(player_idx as usize)
        .copied()
        .unwrap_or(false);
    let was = state.was_on_pit_road.load(Ordering::Relaxed);

    if on_pit && !was {
        state.count.fetch_add(1, Ordering::Relaxed);
    }
    state.was_on_pit_road.store(on_pit, Ordering::Relaxed);

    let stops = state.count.load(Ordering::Relaxed);
    Some(PitStopsFrame {
        player_stops: stops,
    })
}
