//! The files the telemetry layer keeps under the app data directory: one
//! recorded shape per track, one reference lap per track, car and condition.
//!
//! Plain functions on a directory, so the I/O worker and the commands share
//! them and a test can point them at a temporary one. Nothing here may be
//! called from the telemetry loop itself — that goes through `io_worker`.
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use tracing::{info, warn};

use crate::computations::reference_selection::StoredReferences;
use crate::model::reference_lap::{ReferenceLapData, TrackCondition};
use crate::model::session::SessionSnapshot;
use crate::model::track_shape::TrackShapePayload;

const TRACKS_DIR: &str = "tracks";
const REFERENCE_LAPS_DIR: &str = "reference_laps";
const FILE_VERSION: u32 = 1;

pub fn track_shape_path(data_dir: &Path, track_id: i32) -> PathBuf {
    data_dir.join(TRACKS_DIR).join(format!("{track_id}.json"))
}

pub fn reference_lap_path(data_dir: &Path, key: &str) -> PathBuf {
    data_dir
        .join(REFERENCE_LAPS_DIR)
        .join(format!("{key}.json"))
}

/// Filesystem-safe key for a track+car reference lap file, shared with the
/// `delete_reference_lap` command.
pub fn reference_lap_key(
    track_id: i32,
    car_screen_name: &str,
    condition: TrackCondition,
) -> String {
    let sanitized: String = car_screen_name
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();

    format!("{track_id}__{sanitized}__{}", condition.as_key())
}

/// Reads a previously recorded track shape. Returns `None` when no cached file
/// exists for this track or it was written by an older version.
///
/// Shared with the `get_cached_track_shape` command, which re-hydrates windows
/// that subscribed after the one-shot `sim://track-shape` emit.
pub fn load_cached_track_shape(data_dir: &Path, track_id: i32) -> Option<TrackShapePayload> {
    #[derive(serde::Deserialize)]
    struct StoredTrack {
        version: u32,
        #[serde(flatten)]
        payload: TrackShapePayload,
    }

    let json = fs::read_to_string(track_shape_path(data_dir, track_id)).ok()?;
    let stored = serde_json::from_str::<StoredTrack>(&json).ok()?;

    if stored.version < FILE_VERSION {
        return None;
    }

    Some(stored.payload)
}

pub fn save_track_shape(data_dir: &Path, payload: &TrackShapePayload) {
    #[derive(serde::Serialize)]
    struct StoredTrack<'a> {
        version: u32,
        #[serde(flatten)]
        payload: &'a TrackShapePayload,
    }

    if fs::create_dir_all(data_dir.join(TRACKS_DIR)).is_err() {
        return;
    }

    let stored = StoredTrack {
        version: FILE_VERSION,
        payload,
    };

    if let Ok(json) = serde_json::to_string(&stored) {
        let _ = fs::write(track_shape_path(data_dir, payload.track_id), json);
    }
}

/// Writes the learned pit lane markers into the stored track file and returns
/// the patched shape, which the caller re-emits. `None` when there is no
/// recorded track to patch yet.
pub fn patch_pit_lane_pct(
    data_dir: &Path,
    track_id: i32,
    pit_in_pct: f32,
    pit_exit_pct: f32,
) -> Option<TrackShapePayload> {
    info!(
        "patch_pit_lane_pct triggered for track {} (in: {}, exit: {})",
        track_id, pit_in_pct, pit_exit_pct
    );

    let path = track_shape_path(data_dir, track_id);

    let Ok(bytes) = fs::read(&path) else {
        warn!("Failed to read track JSON file from {:?} in patch_pit_lane_pct (maybe track is not complete/recorded yet)", path);
        return None;
    };

    let Ok(mut value) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
        warn!("Failed to parse track JSON from {:?}", path);
        return None;
    };

    if let Some(obj) = value.as_object_mut() {
        obj.insert("pitInPct".to_string(), serde_json::json!(pit_in_pct));
        obj.insert("pitExitPct".to_string(), serde_json::json!(pit_exit_pct));
    }

    let Ok(json) = serde_json::to_string(&value) else {
        warn!("Failed to serialize patched JSON in patch_pit_lane_pct");
        return None;
    };

    if fs::write(&path, &json).is_err() {
        warn!("Failed to write patched track JSON back to {:?}", path);
        return None;
    }

    info!(
        "Successfully patched and saved pit lane calibration to {:?}",
        path
    );

    serde_json::from_str::<TrackShapePayload>(&json).ok()
}

pub fn save_reference_lap(data_dir: &Path, data: &ReferenceLapData) {
    #[derive(serde::Serialize)]
    struct StoredReferenceLap<'a> {
        version: u32,
        #[serde(flatten)]
        payload: &'a ReferenceLapData,
    }

    if fs::create_dir_all(data_dir.join(REFERENCE_LAPS_DIR)).is_err() {
        return;
    }

    let key = reference_lap_key(data.track_id, &data.car_screen_name, data.condition);
    let stored = StoredReferenceLap {
        version: FILE_VERSION,
        payload: data,
    };

    if let Ok(json) = serde_json::to_string(&stored) {
        let _ = fs::write(reference_lap_path(data_dir, &key), json);
    }
}

/// The reference laps stored for the session's track and the player's car —
/// the recorder needs their times so a slower session best never overwrites a
/// faster stored lap, and the coach needs the one matching the weather.
pub fn read_stored_references(data_dir: &Path, session: &SessionSnapshot) -> StoredReferences {
    let car_screen_name = session
        .cars
        .iter()
        .find(|car| car.car_idx == session.player_car_idx)
        .map(|car| car.car_screen_name.as_str())
        .unwrap_or_default();

    let read_lap = |condition: TrackCondition| {
        let key = reference_lap_key(session.track_id, car_screen_name, condition);

        fs::read_to_string(reference_lap_path(data_dir, &key))
            .ok()
            .and_then(|json| serde_json::from_str::<ReferenceLapData>(&json).ok())
            .filter(|lap| lap.lap_time > 0.0)
            .map(Arc::new)
    };

    // Both conditions are read up front: the weather can turn at any point in
    // the session, and the processor must already know what a wet lap has to
    // beat by the time one is driven.
    StoredReferences {
        dry: read_lap(TrackCondition::Dry),
        wet: read_lap(TrackCondition::Wet),
    }
}
