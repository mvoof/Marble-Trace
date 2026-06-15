/// Lap history model — completed lap records for the player.
///
/// Computed by `LapLogProcessor` and emitted in `TelemetryBundle`.
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct LapHistoryEntry {
    /// 1-based lap number that was completed.
    pub lap_num: i32,

    /// Lap time in seconds, or `None` if the lap was invalidated
    /// (pit lane, safety car, penalty, or session reset).
    pub lap_time: Option<f32>,

    /// Seconds relative to the session best lap at the time this lap finished.
    /// `None` for invalid laps or the first best lap (where delta = 0 by definition).
    pub delta: Option<f32>,

    /// Whether this was the driver's personal best at the time it was recorded.
    pub is_best: bool,
}

/// Last completed valid lap — used by DeltaWidget for the flash animation.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct LastCompletedLap {
    pub lap_num: i32,
    pub delta: Option<f32>,
}

/// Lap history frame — emitted at 4 Hz in `TelemetryBundle.lap_log`.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct LapLogFrame {
    /// Most recent entries first; capped at `HISTORY_SIZE`.
    pub history: Vec<LapHistoryEntry>,

    /// Set when a valid lap is completed; used to trigger the lap flash UI.
    pub last_completed_lap: Option<LastCompletedLap>,
}
