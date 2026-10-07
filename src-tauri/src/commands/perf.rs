//! The perf run's two commands, `dev` builds only. See `telemetry::perf_run`.

use tauri::State;

use crate::telemetry::perf_run::{OverlayPerfReport, PerfRunConfig, PerfRunState};
use crate::utils::lock_or_recover;

/// The run in progress, or `None` when the app was not started for one. An
/// overlay reads it once on load: in stores-only mode it mounts no widget.
#[tauri::command]
pub async fn get_perf_run(state: State<'_, PerfRunState>) -> Result<Option<PerfRunConfig>, String> {
    Ok(state.config.clone())
}

/// One overlay's measurements, sent when the run's span ends.
#[tauri::command]
pub async fn submit_overlay_perf(
    report: OverlayPerfReport,
    state: State<'_, PerfRunState>,
) -> Result<(), String> {
    lock_or_recover(&state.reports).push(report);

    Ok(())
}
