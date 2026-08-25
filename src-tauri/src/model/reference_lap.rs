//! Reference (best) lap telemetry model — recorded once per track+car and
//! overwritten whenever a new personal best lap is set. Emitted via
//! `sim://reference-lap/updated`, not part of the tiered `TelemetryBundle`.
use serde::{Deserialize, Serialize};

// Declared with the other values the frontend needs as literals — the coach
// records the lap in progress on this same grid.
pub use crate::model::defaults::REFERENCE_LAP_BUCKET_COUNT;

/// Track wetness (0=dry to 7=flooded) at or above which a lap counts as wet.
///
/// iRacing reports 1 for a dry track and starts climbing as soon as the surface
/// takes water, so the boundary sits at the first genuinely damp step rather
/// than in the middle of the scale — the point where the dry line stops being
/// the fast line is what makes two references necessary in the first place.
const WET_THRESHOLD: i32 = 3;

/// Which track state a reference lap was driven in.
///
/// A dry lap is useless as a target in the rain and vice versa, so each is
/// stored and compared against separately — one file per track+car+condition.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, Default, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub enum TrackCondition {
    #[default]
    Dry,
    Wet,
}

impl TrackCondition {
    /// Classifies a wetness reading. An absent reading means the sim does not
    /// model wetness for this session, which is the dry case.
    pub fn from_wetness(track_wetness: Option<i32>) -> Self {
        match track_wetness {
            Some(wetness) if wetness >= WET_THRESHOLD => Self::Wet,
            _ => Self::Dry,
        }
    }

    /// Stable token used in the reference lap's file name.
    pub fn as_key(self) -> &'static str {
        match self {
            Self::Dry => "dry",
            Self::Wet => "wet",
        }
    }
}

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
    /// Track state this lap was driven in — part of its identity, not just a note.
    /// `serde(default)` reads every reference recorded before the split as dry,
    /// which is what a single stored lap always was in practice.
    #[serde(default)]
    pub condition: TrackCondition,
    /// Track wetness (0=dry to 7=flooded) averaged over this lap, when available.
    pub recorded_wetness: Option<f32>,
    /// Average tire wear (0.0-1.0, 1.0=fresh) across all four tires at the moment this lap was committed.
    pub recorded_tire_wear: Option<f32>,
    /// Fuel level (liters) at the moment this lap was committed.
    pub recorded_fuel_level: Option<f32>,
}

/// Best stored reference lap time per track condition, for the current
/// track+car. Held by the telemetry service and refreshed from disk whenever
/// the session identity changes, so the processor can tell a genuine
/// improvement from a lap that is merely this session's best.
#[derive(Debug, Default, Clone, Copy)]
pub struct StoredReferenceTimes {
    pub dry: Option<f32>,
    pub wet: Option<f32>,
}

impl StoredReferenceTimes {
    pub fn get(&self, condition: TrackCondition) -> Option<f32> {
        match condition {
            TrackCondition::Dry => self.dry,
            TrackCondition::Wet => self.wet,
        }
    }

    pub fn set(&mut self, condition: TrackCondition, lap_time: Option<f32>) {
        match condition {
            TrackCondition::Dry => self.dry = lap_time,
            TrackCondition::Wet => self.wet = lap_time,
        }
    }
}
