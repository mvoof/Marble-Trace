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
}
