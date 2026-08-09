/// Tauri commands — thin wrappers over telemetry state and runtime.
use std::sync::atomic::Ordering;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::time::sleep;
use tracing::{debug, info, warn};

use crate::model::pit_command::PitCommandRequest;
use crate::model::reference_lap::ReferenceLapData;
use crate::model::session::SessionSnapshot;
use crate::model::track_shape::TrackShapePayload;
use crate::sources::iracing::pit_command::send_pit_order as send_pit_order_to_sim;
use crate::telemetry::emitter::reference_lap_key;
use crate::telemetry::runtime::{load_cached_track_shape, spawn_telemetry_thread};
use crate::telemetry::state::TelemetryState;
use crate::utils::lock_or_recover;

/// Upper bound for `set_fuel_avg_window`, matching MAX_LAP_FUEL_HISTORY. 0 = all laps.
const MAX_FUEL_AVG_WINDOW: u32 = 100;

/// A full order is a clear, fuel, four corners, windshield and fast repair —
/// eight messages. The cap is set at twice that so adding a checkbox does not
/// need a bump here; anything past it is a caller bug, not a real pit stop.
const MAX_PIT_ORDER_COMMANDS: usize = 16;

#[tauri::command]
pub async fn get_connection_status(state: State<'_, TelemetryState>) -> Result<bool, String> {
    Ok(state.service.is_connected.load(Ordering::Relaxed))
}

#[tauri::command]
pub async fn log_settings_snapshot(settings: serde_json::Value) -> Result<(), String> {
    crate::logging::log_settings_snapshot(&settings);

    Ok(())
}

/// Copies `settings.json` aside before the frontend writes a newly migrated
/// version over it. `tauri-plugin-store` can only read and write the live file,
/// so the copy has to happen here.
///
/// Best effort by design: a failed backup must not stop the migration, or a
/// user with a read-only config directory could never upgrade.
#[tauri::command]
pub async fn backup_settings_file(app: AppHandle, suffix: String) -> Result<(), String> {
    if !suffix.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(format!("refusing suffix {suffix:?}"));
    }

    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no config dir: {e}"))?;

    let source = dir.join("settings.json");

    if !source.exists() {
        return Ok(());
    }

    let target = dir.join(format!("settings.{suffix}.bak"));

    std::fs::copy(&source, &target).map_err(|e| format!("copy failed: {e}"))?;

    info!("settings backed up to {}", target.display());

    Ok(())
}

#[tauri::command]
pub async fn get_last_session_info(
    state: State<'_, TelemetryState>,
) -> Result<Option<SessionSnapshot>, String> {
    let lock = lock_or_recover(&state.service.last_session_info);

    Ok(lock.as_deref().cloned())
}

#[tauri::command]
pub async fn set_pit_warning_laps(
    state: State<'_, TelemetryState>,
    laps: f32,
) -> Result<(), String> {
    if !laps.is_finite() || laps < 0.0 {
        return Err("pit_warning_laps must be a finite non-negative number".to_string());
    }

    state
        .fuel_tuning
        .pit_warning_laps
        .store(laps.to_bits(), Ordering::Relaxed);

    Ok(())
}

/// Number of recent laps averaged for fuel consumption. 0 = the whole session.
#[tauri::command]
pub async fn set_fuel_avg_window(
    state: State<'_, TelemetryState>,
    window: u32,
) -> Result<(), String> {
    if window > MAX_FUEL_AVG_WINDOW {
        return Err(format!(
            "fuel_avg_window must be between 0 (all laps) and {MAX_FUEL_AVG_WINDOW}"
        ));
    }

    state
        .fuel_tuning
        .avg_window
        .store(window as usize, Ordering::Relaxed);

    debug!("Fuel average window updated to: {window}");

    Ok(())
}

#[tauri::command]
pub async fn set_active_events(state: State<'_, TelemetryState>, mask: u32) -> Result<(), String> {
    state.service.active_events.store(mask, Ordering::Relaxed);

    debug!("Active events mask updated to: {:#b}", mask);

    Ok(())
}

#[tauri::command]
pub async fn set_car_length(state: State<'_, TelemetryState>, length: f32) -> Result<(), String> {
    if !(0.5..=15.0).contains(&length) || !length.is_finite() {
        return Err("Car length must be a finite value between 0.5 and 15.0 meters".to_string());
    }

    let mut lock = lock_or_recover(&state.service.car_length_m);

    *lock = length;
    debug!("Car length updated in backend to: {}m", length);

    Ok(())
}

#[tauri::command]
pub async fn start_telemetry_stream(
    app: AppHandle,
    state: State<'_, TelemetryState>,
) -> Result<(), String> {
    info!("start_telemetry_stream command received");

    state.service.running.store(false, Ordering::SeqCst);

    sleep(Duration::from_millis(50)).await;

    state.service.running.store(true, Ordering::SeqCst);

    spawn_telemetry_thread(
        app,
        state.service.clone(),
        state.registry.clone(),
        state.fuel_tuning.clone(),
    )
}

#[tauri::command]
pub async fn stop_telemetry_stream(state: State<'_, TelemetryState>) -> Result<(), String> {
    state.service.running.store(false, Ordering::SeqCst);

    debug!("Telemetry stream stopped");

    Ok(())
}

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
) -> Result<Option<ReferenceLapData>, String> {
    let Ok(data_dir) = app.path().app_data_dir() else {
        return Err("Cannot resolve app data dir".to_string());
    };

    let key = reference_lap_key(track_id, &car_screen_name);
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

    let key = reference_lap_key(track_id, &car_screen_name);
    let path = data_dir.join("reference_laps").join(format!("{key}.json"));

    match tokio::fs::remove_file(&path).await {
        Ok(_) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(e.to_string()),
    }

    // The processor keeps the session's best time in memory and would refuse
    // to commit a slower lap as the new reference — reset it so recording
    // starts fresh from the next completed lap.
    state
        .reset_reference_lap
        .store(true, std::sync::atomic::Ordering::Relaxed);

    if let Ok(mut stored) = state.service.stored_reference_lap_time.lock() {
        *stored = None;
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

/// Sends a pit service order to the sim. Only ever called from an explicit user
/// action — the widget never orders anything on its own.
///
/// The SDK broadcast is fire-and-forget: a successful return means the messages
/// were posted, not that iRacing accepted them. The sim ignores pit commands
/// unless the driver is in the car.
#[tauri::command]
pub async fn send_pit_order(requests: Vec<PitCommandRequest>) -> Result<(), String> {
    if requests.len() > MAX_PIT_ORDER_COMMANDS {
        return Err(format!(
            "pit order must not exceed {} commands",
            MAX_PIT_ORDER_COMMANDS
        ));
    }

    info!(count = requests.len(), "sending pit order");

    send_pit_order_to_sim(&requests)
}
