//! Reference (best) lap telemetry model — recorded once per track+car and
//! overwritten whenever a new personal best lap is set. Emitted via
//! `sim://reference-lap/updated`, not part of the tiered `TelemetryBundle`.
use serde::{Deserialize, Serialize};

/// Number of lap-distance buckets a reference lap is sampled into (≈0.1% resolution).
pub const REFERENCE_LAP_BUCKET_COUNT: usize = 1000;

#[derive(Serialize, Deserialize, Debug, Clone, Copy, Default, PartialEq)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ReferenceLapSample {
    /// Speed in m/s.
    pub speed: f32,
    /// Throttle input, 0.0-1.0.
    pub throttle: f32,
    /// Brake input, 0.0-1.0.
    pub brake: f32,
    /// Lateral acceleration in m/s^2, when the sim provides it.
    pub lat_accel: Option<f32>,
    /// Longitudinal acceleration in m/s^2, when the sim provides it.
    /// `serde(default)` keeps reference laps persisted before this field existed loadable.
    #[serde(default)]
    pub long_accel: Option<f32>,
    /// Steering wheel angle in radians.
    pub steering_wheel_angle: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct ReferenceLapData {
    pub track_id: i32,
    pub car_screen_name: String,
    /// Best lap time in seconds this reference telemetry was recorded from.
    pub lap_time: f32,
    /// Fixed-size, distance-bucketed samples — index `i` covers
    /// `lap_dist_pct` in `[i / REFERENCE_LAP_BUCKET_COUNT, (i+1) / REFERENCE_LAP_BUCKET_COUNT)`.
    pub samples: Vec<ReferenceLapSample>,
    /// Track wetness (0=dry to 7=flooded) averaged over this lap, when available.
    pub recorded_wetness: Option<f32>,
    /// Average tire wear (0.0-1.0, 1.0=fresh) across all four tires at the moment this lap was committed.
    pub recorded_tire_wear: Option<f32>,
    /// Fuel level (liters) at the moment this lap was committed.
    pub recorded_fuel_level: Option<f32>,
}
