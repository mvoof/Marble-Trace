/// Session telemetry — real-time session state from the telemetry stream.
///
/// Contains session time, remaining time, session state flags,
/// and current session index. Changes infrequently compared to car data.
///
/// For static session YAML data (driver info, weekend info), see
/// `pitwall::SessionInfo` emitted via `iracing://session-info`.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::iracing::enums::SessionState;

use super::AllFieldsFrame;

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct SessionFrame {
    /// Seconds since the session started
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessiontime/
    pub session_time: Option<f64>,

    /// Seconds remaining in the session
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessiontimeremain/
    pub session_time_remain: Option<f64>,

    /// Session state enum value (invalid, warmup, racing, etc.)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessionstate/
    pub session_state: Option<SessionState>,

    /// Session flags bit field (green, yellow, red, etc.)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessionflags/
    pub session_flags: Option<u32>,

    /// Index of the current session (practice=0, qualifying=1, race=2, etc.)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessionnum/
    pub session_num: Option<i32>,

    /// In-simulator time of day in seconds since midnight
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessiontimeofday/
    pub session_time_of_day: Option<f32>,

    /// Index of the player's car in CarIdx arrays
    /// @see https://sajax.github.io/irsdkdocs/telemetry/playercaridx/
    pub player_car_idx: Option<i32>,

    /// Per-car session flags for the player's car (black flag, DQ, meatball, etc.)
    /// Extracted from CarIdxSessionFlags[player_car_idx]
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxsessionflags/
    pub player_car_flags: Option<u32>,
}

impl From<&AllFieldsFrame> for SessionFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        let player_car_flags = f.player_car_idx.and_then(|idx| {
            f.car_idx_session_flags
                .get(idx as usize)
                .map(|bf| bf.0)
        });

        Self {
            session_time: f.session_time,
            session_time_remain: f.session_time_remain,
            session_state: f.session_state.map(SessionState::from),
            session_flags: f.session_flags,
            session_num: f.session_num,
            session_time_of_day: f.session_time_of_day,
            player_car_idx: f.player_car_idx,
            player_car_flags,
        }
    }
}
