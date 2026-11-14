//! The statistics, read by the main window.

use std::sync::Arc;

use tauri::State;

use mt_model::app::stats::{RecentSession, StatsImportStatus};
use mt_stats::import::StatsService;

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
