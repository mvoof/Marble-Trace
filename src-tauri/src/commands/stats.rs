//! The statistics, read by the main window.

use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::{AppHandle, State};

use mt_model::app::stats::{AutologState, HomeStats, RecentSession, StatsImportStatus};
use mt_sim_iracing::app_ini;
use mt_stats::import::StatsService;
use mt_telemetry::state::TelemetryState;

use crate::stats;

#[tauri::command]
pub async fn get_stats_import_status(
    state: State<'_, Arc<StatsService>>,
) -> Result<StatsImportStatus, String> {
    Ok(state.status())
}

#[tauri::command]
pub async fn get_recent_sessions(
    state: State<'_, Arc<StatsService>>,
    limit: u32,
) -> Result<Vec<RecentSession>, String> {
    let service = Arc::clone(&state);

    tauri::async_runtime::spawn_blocking(move || service.recent_sessions(limit))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn get_home_stats(state: State<'_, Arc<StatsService>>) -> Result<HomeStats, String> {
    let service = Arc::clone(&state);

    tauri::async_runtime::spawn_blocking(move || service.home_stats())
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn get_autolog_state(app: AppHandle) -> Result<AutologState, String> {
    let Some(path) = stats::sim_settings_file(&app) else {
        return Ok(AutologState::Unknown);
    };

    Ok(app_ini::read_autolog(&path))
}

/// Refused while the sim runs: it writes its settings back when it closes.
#[tauri::command]
pub async fn enable_autolog(
    app: AppHandle,
    telemetry: State<'_, TelemetryState>,
) -> Result<AutologState, String> {
    if telemetry.service.is_connected.load(Ordering::Relaxed) {
        return Err("Close iRacing first: it rewrites app.ini when it exits".into());
    }

    let path = stats::sim_settings_file(&app).ok_or("Documents folder not found")?;

    app_ini::enable_autolog(&path)
}
