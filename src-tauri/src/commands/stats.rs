//! The statistics, read by the main window.

use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::{AppHandle, Manager, State};

use mt_model::app::stats::{
    AutologState, HomeStats, KnownCar, RecentSession, SkippedFile, StatsFolder, StatsImportStatus,
    TrackOutline,
};
use mt_sim_iracing::app_ini;
use mt_sim_iracing::car_badges::badge_for_car;
use mt_stats::import::{PassScope, StatsService};
use mt_telemetry::state::TelemetryState;
use mt_telemetry::storage::load_cached_track_shape;

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
pub async fn get_home_stats(
    app: AppHandle,
    state: State<'_, Arc<StatsService>>,
) -> Result<HomeStats, String> {
    let service = Arc::clone(&state);
    let data_dir = app.path().app_data_dir().ok();

    tauri::async_runtime::spawn_blocking(move || {
        let mut stats = service.home_stats()?;

        // A track no session file drew may still have the shape the track map
        // recorded on it.
        if let (Some(race), Some(data_dir)) = (stats.last_race.as_mut(), data_dir) {
            if race.outline.is_none() {
                race.outline = race
                    .track_id
                    .and_then(|track_id| load_cached_track_shape(&data_dir, track_id))
                    .map(|shape| TrackOutline {
                        svg_path: shape.svg_path,
                        view_box: shape.view_box,
                    });
            }
        }

        Ok(stats)
    })
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

#[tauri::command]
pub async fn get_stats_folder(state: State<'_, Arc<StatsService>>) -> Result<StatsFolder, String> {
    let service = Arc::clone(&state);

    tauri::async_runtime::spawn_blocking(move || service.folder())
        .await
        .map_err(|error| error.to_string())
}

/// `None` goes back to the sim's own folder. The import looks at it at once.
#[tauri::command]
pub async fn set_stats_folder(
    state: State<'_, Arc<StatsService>>,
    path: Option<String>,
) -> Result<StatsFolder, String> {
    let service = Arc::clone(&state);

    tauri::async_runtime::spawn_blocking(move || service.set_folder(path.as_deref()))
        .await
        .map_err(|error| error.to_string())?
}

/// Reads every file in the folder again, the skipped ones too.
#[tauri::command]
pub async fn reimport_stats(state: State<'_, Arc<StatsService>>) -> Result<(), String> {
    state.request_pass(PassScope::All);

    Ok(())
}

#[tauri::command]
pub async fn get_skipped_files(
    state: State<'_, Arc<StatsService>>,
) -> Result<Vec<SkippedFile>, String> {
    let service = Arc::clone(&state);

    tauri::async_runtime::spawn_blocking(move || service.skipped_files())
        .await
        .map_err(|error| error.to_string())?
}

/// The cars of the session records, each with the class badge a live session
/// would give it, so a rule picked offline matches the car on track.
#[tauri::command]
pub async fn get_known_cars(state: State<'_, Arc<StatsService>>) -> Result<Vec<KnownCar>, String> {
    let service = Arc::clone(&state);
    let cars = tauri::async_runtime::spawn_blocking(move || service.known_cars())
        .await
        .map_err(|error| error.to_string())??;

    Ok(cars
        .into_iter()
        .map(|car| KnownCar {
            car_class: badge_for_car(car.car_id)
                .map(str::to_string)
                .or(car.car_class),
            ..car
        })
        .collect())
}

/// Writes every session record to `path` as CSV. Returns how many.
#[tauri::command]
pub async fn export_sessions_csv(
    state: State<'_, Arc<StatsService>>,
    path: String,
) -> Result<u32, String> {
    let service = Arc::clone(&state);

    tauri::async_runtime::spawn_blocking(move || {
        service.export_sessions_csv(std::path::Path::new(&path))
    })
    .await
    .map_err(|error| error.to_string())?
}
