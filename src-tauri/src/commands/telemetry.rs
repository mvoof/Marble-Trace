//! Commands that drive the telemetry runtime: starting and stopping the feed,
//! reading its current state, and the few knobs the settings UI turns on the
//! processors behind it.

use std::sync::atomic::Ordering;
use std::time::Duration;

use tauri::{AppHandle, State};
use tokio::time::sleep;
use tracing::{debug, info};

use crate::model::defaults::MAX_FUEL_AVG_WINDOW;
use crate::model::session::SessionSnapshot;
use crate::sources::source::SourceFrame;
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
pub async fn set_active_events(state: State<'_, TelemetryState>, mask: u32) -> Result<(), String> {
    state.service.active_events.store(mask, Ordering::Relaxed);

    debug!("Active events mask updated to: {:#b}", mask);

    Ok(())
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
pub async fn set_car_length(state: State<'_, TelemetryState>, length: f32) -> Result<(), String> {
    if !(0.5..=15.0).contains(&length) || !length.is_finite() {
        return Err("Car length must be a finite value between 0.5 and 15.0 meters".to_string());
    }

    let mut lock = lock_or_recover(&state.service.car_length_m);

    *lock = length;
    debug!("Car length updated in backend to: {}m", length);

    Ok(())
}

/// Opens and closes the telemetry inspector's data feed.
///
/// The inspector deliberately pulls rather than subscribing: resubscribing the
/// settings window to the telemetry bundle is exactly the cost that was removed
/// from it. While this is off the backend keeps no frame at all.
#[tauri::command]
pub async fn set_inspector_active(
    state: State<'_, TelemetryState>,
    active: bool,
) -> Result<(), String> {
    state
        .service
        .inspector_active
        .store(active, Ordering::Relaxed);

    if !active {
        *lock_or_recover(&state.service.inspector_frame) = None;
    }

    debug!("Telemetry inspector active: {active}");

    Ok(())
}

/// The last adapted frame, or `None` when the sim is not connected or the feed
/// was only just switched on. Deliberately the whole `SourceFrame` and not the
/// bundle: the point of the inspector is to show what the sim gives us,
/// including the fields the app does not forward to any widget.
#[tauri::command]
pub async fn get_inspector_frame(
    state: State<'_, TelemetryState>,
) -> Result<Option<SourceFrame>, String> {
    Ok(lock_or_recover(&state.service.inspector_frame).clone())
}
