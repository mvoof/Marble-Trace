/// Lap timing telemetry — lap times, distances, and race positions.
///
/// Contains current/last/best lap times, distance around track,
/// and overall/class position standings.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct LapTimingFrame {
    /// Current lap number
    /// @see https://sajax.github.io/irsdkdocs/telemetry/lap/
    pub lap: Option<i32>,

    /// Distance traveled on current lap in meters
    /// @see https://sajax.github.io/irsdkdocs/telemetry/lapdist/
    pub lap_dist: Option<f32>,

    /// Percentage of current lap completed: 0.0 to 1.0
    /// @see https://sajax.github.io/irsdkdocs/telemetry/lapdistpct/
    pub lap_dist_pct: Option<f32>,

    /// Current lap time in seconds
    /// @see https://sajax.github.io/irsdkdocs/telemetry/lapcurrentlaptime/
    pub lap_current_lap_time: f32,

    /// Last completed lap time in seconds
    /// @see https://sajax.github.io/irsdkdocs/telemetry/laplastlaptime/
    pub lap_last_lap_time: Option<f32>,

    /// Best lap time in seconds
    /// @see https://sajax.github.io/irsdkdocs/telemetry/lapbestlaptime/
    pub lap_best_lap_time: Option<f32>,

    /// Player's overall position in the race
    /// @see https://sajax.github.io/irsdkdocs/telemetry/playercarposition/
    pub player_car_position: Option<i32>,

    /// Player's position within their car class
    /// @see https://sajax.github.io/irsdkdocs/telemetry/playercarclassposition/
    pub player_car_class_position: Option<i32>,

    /// Live delta to session best lap
    pub lap_delta_to_session_best_live: Option<f32>,

    /// Live delta to session optimal lap
    pub lap_delta_to_session_optimal_live: Option<f32>,
}
