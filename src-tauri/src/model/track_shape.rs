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
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TrackRecordingFrame {
    pub is_recording: bool,
    pub is_waiting_for_sf: bool,
    pub progress: f32,
}
