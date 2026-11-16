//! The statistics, read by the main window.

use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::{AppHandle, Manager, State};

use mt_model::app::stats::{
    AnalysisSet, AutologState, HomeStats, KnownCar, LapRef, RecentSession, SessionFilter,
    SessionLaps, SessionPage, SkippedFile, StatsFolder, StatsImportStatus, TrackOutline,
};
use mt_sim_iracing::app_ini;
use mt_sim_iracing::car_badges::badge_for_car;
use mt_stats::db::StatsDb;
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

/// The folder `settings.json` names; `None` is the sim's own. Main sends it
/// after loading the settings and on every change; the import waits for the
/// first one and looks at each at once.
#[tauri::command]
pub async fn set_stats_folder(
    state: State<'_, Arc<StatsService>>,
    path: Option<String>,
) -> Result<StatsFolder, String> {
    Ok(state.set_folder(path.as_deref()))
}

/// The folder an older `stats.db` held, once: main moves it into
/// `settings.json` when the settings name none.
#[tauri::command]
pub async fn take_legacy_stats_folder(
    state: State<'_, Arc<StatsService>>,
) -> Result<Option<String>, String> {
    let service = Arc::clone(&state);

    tauri::async_runtime::spawn_blocking(move || service.take_legacy_folder())
        .await
        .map_err(|error| error.to_string())
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

/// One page of the sessions table, filtered in the database.
#[tauri::command]
pub async fn get_sessions_page(
    state: State<'_, Arc<StatsService>>,
    filter: SessionFilter,
    page: u32,
) -> Result<SessionPage, String> {
    let service = Arc::clone(&state);

    tauri::async_runtime::spawn_blocking(move || service.sessions_page(&filter, page))
        .await
        .map_err(|error| error.to_string())?
}

/// A session's laps for the session modal; `None` when it is not read.
#[tauri::command]
pub async fn get_session_laps(
    state: State<'_, Arc<StatsService>>,
    key: String,
) -> Result<Option<SessionLaps>, String> {
    let service = Arc::clone(&state);

    tauri::async_runtime::spawn_blocking(move || service.session_laps(&key))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn get_analysis_set(state: State<'_, Arc<StatsService>>) -> Result<AnalysisSet, String> {
    let service = Arc::clone(&state);

    tauri::async_runtime::spawn_blocking(move || service.analysis_set())
        .await
        .map_err(|error| error.to_string())?
}

/// The analysis set after `change`, run off the async runtime.
async fn change_analysis(
    state: State<'_, Arc<StatsService>>,
    change: impl FnOnce(&mut StatsDb) -> Result<(), String> + Send + 'static,
) -> Result<AnalysisSet, String> {
    let service = Arc::clone(&state);

    tauri::async_runtime::spawn_blocking(move || service.change_analysis(change))
        .await
        .map_err(|error| error.to_string())?
}

/// Laps of another session than the set's replace it.
#[tauri::command]
pub async fn add_analysis_laps(
    state: State<'_, Arc<StatsService>>,
    key: String,
    laps: Vec<LapRef>,
) -> Result<AnalysisSet, String> {
    change_analysis(state, move |db| db.add_analysis_laps(&key, &laps)).await
}

#[tauri::command]
pub async fn remove_analysis_lap(
    state: State<'_, Arc<StatsService>>,
    lap: LapRef,
) -> Result<AnalysisSet, String> {
    change_analysis(state, move |db| db.remove_analysis_lap(&lap)).await
}

#[tauri::command]
pub async fn set_analysis_lap_color(
    state: State<'_, Arc<StatsService>>,
    lap: LapRef,
    color: String,
) -> Result<AnalysisSet, String> {
    change_analysis(state, move |db| db.set_analysis_lap_color(&lap, &color)).await
}

#[tauri::command]
pub async fn set_analysis_lap_visible(
    state: State<'_, Arc<StatsService>>,
    lap: LapRef,
    visible: bool,
) -> Result<AnalysisSet, String> {
    change_analysis(state, move |db| db.set_analysis_lap_visible(&lap, visible)).await
}

#[tauri::command]
pub async fn set_analysis_reference(
    state: State<'_, Arc<StatsService>>,
    lap: LapRef,
) -> Result<AnalysisSet, String> {
    change_analysis(state, move |db| db.set_analysis_reference(&lap)).await
}
