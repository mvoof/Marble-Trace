//! Track shape model — computed once per track, emitted via `sim://track-shape`.
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TrackPoint {
    pub x: f32,
    pub y: f32,
    pub pct: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TrackShapePayload {
    pub track_id: i32,
    pub svg_path: String,
    pub view_box: String,
    pub points: Vec<TrackPoint>,
    /// Lap distance fraction where player crossed into pit road (on_pit_road false→true).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pit_in_pct: Option<f32>,
    /// Lap distance fraction where player exited pit road (on_pit_road true→false).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pit_exit_pct: Option<f32>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TrackRecordingFrame {
    pub is_recording: bool,
    pub is_waiting_for_sf: bool,
    pub progress: f32,
    /// pit_in_pct detected but pit_exit_pct not yet — actively traversing pit lane.
    pub pit_lane_recording: bool,
}
