//! Commands about the track the session is on: the recorded shape of it, the
//! pit lane markers learned from driving through, and the reference lap stored
//! per track and car.

use tauri::{AppHandle, Emitter, Manager, State};
use tracing::{info, warn};

use crate::model::reference_lap::{ReferenceLapData, StoredReferenceTimes, TrackCondition};
use crate::model::track_shape::TrackShapePayload;
use crate::telemetry::emitter::reference_lap_key;
use crate::telemetry::runtime::load_cached_track_shape;
use crate::telemetry::state::TelemetryState;
use crate::utils::lock_or_recover;

#[tauri::command]
pub async fn reset_pit_lane_pct(
    app: AppHandle,
    state: State<'_, TelemetryState>,
    track_id: i32,
) -> Result<(), String> {
    use crate::telemetry::emitter::EVENT_TRACK_SHAPE;
    use std::fs;

    info!("reset_pit_lane_pct command received for track {}", track_id);

    let Ok(data_dir) = app.path().app_data_dir() else {
        warn!("Failed to resolve app data dir in reset_pit_lane_pct");
        return Err("Cannot resolve app data dir".to_string());
    };

    let path = data_dir.join("tracks").join(format!("{}.json", track_id));

    let Ok(bytes) = fs::read(&path) else {
        warn!("No track file found at {:?}, nothing to reset", path);
        return Ok(());
    };

    let Ok(mut value) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
        warn!("Failed to parse track json from {:?}", path);
        return Ok(());
    };

    if let Some(obj) = value.as_object_mut() {
        obj.remove("pitInPct");
        obj.remove("pitExitPct");
    }

    let Ok(json) = serde_json::to_string(&value) else {
        warn!("Failed to serialize track JSON after removing pit pcts");
        return Ok(());
    };

    if fs::write(&path, &json).is_ok() {
        info!("Successfully removed pit pcts from {:?} on disk", path);
        if let Ok(payload) = serde_json::from_str::<TrackShapePayload>(&json) {
            let _ = app.emit(EVENT_TRACK_SHAPE, &payload);
        }
    } else {
        warn!("Failed to write updated track JSON to {:?}", path);
    }

    if let Ok(mut lock) = state.service.pit_in_pct.lock() {
        *lock = None;
    }
    if let Ok(mut lock) = state.service.pit_exit_pct.lock() {
        *lock = None;
    }

    state
        .reset_pit_pcts
        .store(true, std::sync::atomic::Ordering::Relaxed);

    info!("Pit lane pcts successfully reset in memory and scheduled for processor");
    Ok(())
}

#[tauri::command]
pub async fn get_reference_lap(
    app: AppHandle,
    track_id: i32,
    car_screen_name: String,
    condition: TrackCondition,
) -> Result<Option<ReferenceLapData>, String> {
    let Ok(data_dir) = app.path().app_data_dir() else {
        return Err("Cannot resolve app data dir".to_string());
    };

    let key = reference_lap_key(track_id, &car_screen_name, condition);
    let path = data_dir.join("reference_laps").join(format!("{key}.json"));

    let Ok(bytes) = tokio::fs::read(&path).await else {
        return Ok(None);
    };

    match serde_json::from_slice::<ReferenceLapData>(&bytes) {
        Ok(data) => Ok(Some(data)),
        Err(e) => {
            warn!("Failed to parse reference lap file at {:?}: {}", path, e);
            Ok(None)
        }
    }
}

#[tauri::command]
pub async fn delete_reference_lap(
    app: AppHandle,
    state: State<'_, TelemetryState>,
    track_id: i32,
    car_screen_name: String,
) -> Result<(), String> {
    let Ok(data_dir) = app.path().app_data_dir() else {
        return Err("Cannot resolve app data dir".to_string());
    };

    // Both conditions go: the button means "forget my reference for this
    // track and car", and leaving the wet one behind would silently resurrect
    // a reference the driver just deleted the next time it rained.
    for condition in [TrackCondition::Dry, TrackCondition::Wet] {
        let key = reference_lap_key(track_id, &car_screen_name, condition);
        let path = data_dir.join("reference_laps").join(format!("{key}.json"));

        match tokio::fs::remove_file(&path).await {
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.to_string()),
        }
    }

    // The processor keeps the session's best time in memory and would refuse
    // to commit a slower lap as the new reference — reset it so recording
    // starts fresh from the next completed lap.
    state
        .reset_reference_lap
        .store(true, std::sync::atomic::Ordering::Relaxed);

    if let Ok(mut stored) = state.service.stored_reference_lap_time.lock() {
        *stored = StoredReferenceTimes::default();
    }

    info!("Reference lap deleted for track {track_id} / {car_screen_name}");
    Ok(())
}

/// Returns the cached shape of the session's current track, if one was recorded
/// before. `sim://track-shape` is emitted once per track change, so a window
/// that subscribed later (overlay opened mid-session, dev reload) needs this to
/// hydrate its map instead of sitting on the recording overlay forever.
#[tauri::command]
pub async fn get_cached_track_shape(
    app: AppHandle,
    state: State<'_, TelemetryState>,
) -> Result<Option<TrackShapePayload>, String> {
    let track_id = {
        let lock = lock_or_recover(&state.service.last_session_info);
        lock.as_deref().map(|session| session.track_id)
    };

    let Some(track_id) = track_id else {
        return Ok(None);
    };

    Ok(load_cached_track_shape(&app, track_id))
}

#[tauri::command]
pub async fn delete_track_shape(app: AppHandle, track_id: i32) -> Result<(), String> {
    let Ok(data_dir) = app.path().app_data_dir() else {
        return Err("Cannot resolve app data dir".to_string());
    };

    let path = data_dir.join("tracks").join(format!("{}.json", track_id));

    match std::fs::remove_file(&path) {
        Ok(_) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.to_string()),
    }

    Ok(())
}
