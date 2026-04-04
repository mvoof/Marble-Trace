/// Car index telemetry — per-car array data for all cars in session.
///
/// Contains lap distance percentages, pit road status, and position data
/// for every car in the session (indexed by car index). Also includes
/// the player's CarLeftRight proximity indicator.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/caridxlapdistpct/
/// @see https://sajax.github.io/irsdkdocs/telemetry/carleftright/
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct CarIdxFrame {
    /// Percentage distance around lap for each car (-1 = not on track)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxlapdistpct/
    pub car_idx_lap_dist_pct: Vec<f32>,

    /// Whether each car is on pit road
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxonpitroad/
    pub car_idx_on_pit_road: Vec<bool>,

    /// Overall race position for each car
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxposition/
    pub car_idx_position: Vec<i32>,

    /// Class position for each car
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxclassposition/
    pub car_idx_class_position: Vec<i32>,

    /// Proximity indicator bit field for cars nearby
    /// @see https://sajax.github.io/irsdkdocs/telemetry/carleftright/
    pub car_left_right: Option<i32>,
}
