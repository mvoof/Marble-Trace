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
    pub session_state: Option<i32>,

    /// Session flags bit field (green, yellow, red, etc.)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessionflags/
    pub session_flags: Option<i32>,

    /// Index of the current session (practice=0, qualifying=1, race=2, etc.)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessionnum/
    pub session_num: Option<i32>,
}
