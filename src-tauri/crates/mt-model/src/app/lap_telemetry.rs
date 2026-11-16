//! A session file's laps resampled for the analysis: every channel on one
//! distance grid, a value a metre from the line.

use serde::{Deserialize, Serialize};

use crate::app::stats::LapRef;

/// The time since the line, added to the file's channels: the delta between
/// two laps is the difference of theirs.
pub const ELAPSED_CHANNEL: &str = "ElapsedTime";

/// A channel a file holds, as "+ Channel" offers it.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LapChannel {
    /// As the sim names it, e.g. `Speed`.
    pub name: String,
    /// As the sim writes it, e.g. `m/s`; empty when it gives none.
    pub unit: String,
    /// The sim's own words for it.
    pub description: String,
}

/// A lap of a run in one file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct LapKey {
    pub session_num: i32,
    pub lap_num: i32,
}

/// One lap on the grid: a value per grid point for each of the file's
/// channels, in `FileTelemetry::channels` order.
#[derive(Debug, Clone, PartialEq)]
pub struct LapTelemetry {
    pub lap: LapKey,
    pub values: Vec<Vec<f32>>,
}

/// What a file held of the laps asked for. A lap the file does not hold is
/// left out.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct FileTelemetry {
    /// Grid points: 0 m, 1 m … the track length.
    pub points: usize,
    pub channels: Vec<LapChannel>,
    pub laps: Vec<LapTelemetry>,
}

/// What a load of the analysis laps ended with.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisLoad {
    /// Grid points of every lap: 0 m, 1 m … the track length.
    pub points: u32,
    /// The channels the laps' files hold, the time since the line last.
    pub channels: Vec<LapChannel>,
    /// Laps not loaded: the file is gone, or does not hold the lap.
    pub missing: Vec<LapRef>,
}
