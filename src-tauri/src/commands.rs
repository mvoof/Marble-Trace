/// Tauri commands — thin wrappers over telemetry state and runtime.
use std::sync::atomic::Ordering;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::time::sleep;
use tracing::{debug, info};

use crate::model::session::SessionSnapshot;
use crate::telemetry::runtime::spawn_telemetry_thread;
use crate::telemetry::state::TelemetryState;
use crate::utils::lock_or_recover;

#[tauri::command]
pub async fn get_connection_status(state: State<'_, TelemetryState>) -> Result<bool, String> {
    Ok(state.service.is_connected.load(Ordering::Relaxed))
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
        .pit_warning_laps
        .store(laps.to_bits(), Ordering::Relaxed);

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
        state.pit_warning_laps.clone(),
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
    use crate::model::track_shape::TrackShapePayload;
    use crate::telemetry::emitter::EVENT_TRACK_SHAPE;
    use std::fs;

    let Ok(data_dir) = app.path().app_data_dir() else {
        return Err("Cannot resolve app data dir".to_string());
    };

    let path = data_dir.join("tracks").join(format!("{}.json", track_id));

    let Ok(bytes) = fs::read(&path) else {
        return Ok(());
    };

    let Ok(mut value) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
        return Ok(());
    };

    if let Some(obj) = value.as_object_mut() {
        obj.remove("pitInPct");
        obj.remove("pitExitPct");
    }

    let Ok(json) = serde_json::to_string(&value) else {
        return Ok(());
    };

    if fs::write(&path, &json).is_ok() {
        if let Ok(payload) = serde_json::from_str::<TrackShapePayload>(&json) {
            let _ = app.emit(EVENT_TRACK_SHAPE, &payload);
        }
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

    Ok(())
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
