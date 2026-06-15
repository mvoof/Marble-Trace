/// Relative list model — per-car entries sorted by proximity to the player.
///
/// Computed by `RelativeProcessor` and emitted in `TelemetryBundle`.
use serde::{Deserialize, Serialize};

use crate::computations::standings::DriverEntry;

/// Relative frame — emitted at 10 Hz in `TelemetryBundle.relative`.
///
/// Entries are sorted by `relative_lap_dist` descending so that cars ahead
/// of the player appear first (positive values), the player is in the middle,
/// and cars behind (negative values) appear last.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct RelativeFrame {
    /// Entries sorted by `relative_lap_dist` descending.
    pub entries: Vec<DriverEntry>,
    /// The `car_idx` of the player's car.
    pub player_car_idx: i32,
}
