/// Car index telemetry — per-car array data for all cars in session.
///
/// Contains lap distance percentages, pit road status, position data,
/// lap times, and track surface state for every car in the session
/// (indexed by car index). Also includes the player's CarLeftRight
/// proximity indicator.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/caridxlapdistpct/
/// @see https://sajax.github.io/irsdkdocs/telemetry/carleftright/
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::iracing::enums::TrackSurface;

use super::AllFieldsFrame;

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

    /// Current lap number for each car
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxlap/
    pub car_idx_lap: Vec<i32>,

    /// Last lap time in seconds for each car (-1 = no time)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxlastlaptime/
    pub car_idx_last_lap_time: Vec<f32>,

    /// Best lap time in seconds for each car (-1 = no time)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxbestlaptime/
    pub car_idx_best_lap_time: Vec<f32>,

    /// Race time behind leader or fastest car in seconds
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxf2time/
    pub car_idx_f2_time: Vec<f32>,

    /// Estimated time around track for each car in seconds
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxesttime/
    pub car_idx_est_time: Vec<f32>,

    /// Track surface type for each car (irsdk_TrkLoc enum)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxtracksurface/
    pub car_idx_track_surface: Vec<TrackSurface>,

    /// Tire compound index per car. Maps into DriverInfo.DriverTires[].
    /// -1 = unknown.
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxtirecompound/
    pub car_idx_tire_compound: Vec<i32>,

    /// Proximity indicator bit field for cars nearby
    /// @see https://sajax.github.io/irsdkdocs/telemetry/carleftright/
    pub car_left_right: Option<i32>,
}

impl From<&AllFieldsFrame> for CarIdxFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        Self {
            car_idx_lap_dist_pct: f.car_idx_lap_dist_pct.clone(),
            car_idx_on_pit_road: f.car_idx_on_pit_road.clone(),
            car_idx_position: f.car_idx_position.clone(),
            car_idx_class_position: f.car_idx_class_position.clone(),
            car_idx_lap: f.car_idx_lap.clone(),
            car_idx_last_lap_time: f.car_idx_last_lap_time.clone(),
            car_idx_best_lap_time: f.car_idx_best_lap_time.clone(),
            car_idx_f2_time: f.car_idx_f2_time.clone(),
            car_idx_est_time: f.car_idx_est_time.clone(),
            car_idx_track_surface: f
                .car_idx_track_surface
                .iter()
                .map(|&v| TrackSurface::from(v))
                .collect(),
            car_idx_tire_compound: f.car_idx_tire_compound.clone(),
            car_left_right: f.car_left_right,
        }
    }
}
