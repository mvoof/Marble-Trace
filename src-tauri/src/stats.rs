//! The statistics' link to the app: where `stats.db` and the sim's session
//! files are, and the connection the import pauses on.

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::{AppHandle, Manager};

use mt_stats::db::StatsDb;
use mt_stats::import::{self, SessionFileReaders, StatsHost, StatsService};
use mt_stats::lap_cache::{LapCache, LapCacheHost};
use mt_telemetry::state::TelemetryState;

use crate::process_priority;
use crate::sink::TauriSink;

const STATS_DB_FILE: &str = "stats.db";

/// Opens `stats.db`, manages the service the commands read, and starts the
/// import. Without a database the app runs on and the commands report it.
pub fn start(app: &AppHandle) {
    let db = match open_db(app) {
        Ok(db) => db,
        Err(error) => {
            tracing::error!(%error, "stats.db not opened; statistics are off");
            return;
        }
    };
    let service = Arc::new(StatsService::new(db, session_file_folder(app)));
    let telemetry = Arc::clone(&app.state::<TelemetryState>().service);
    let host = StatsHost::new(
        Arc::new(TauriSink(app.clone())),
        SessionFileReaders {
            read_file: mt_sim_iracing::ibt::read_session_file,
            read_laps: mt_sim_iracing::ibt::read_stored_lap_telemetry,
            read_setup: mt_sim_iracing::ibt::read_car_setup,
        },
        Box::new(move || telemetry.is_connected.load(Ordering::Relaxed)),
        // Background work: files read again after a schema step wait for the game.
        process_priority::lower_current_thread,
    );

    let stored = Arc::clone(&service);

    app.manage(Arc::clone(&service));
    app.manage(Arc::new(LapCache::start(LapCacheHost {
        read_laps: mt_sim_iracing::ibt::read_lap_telemetry,
        read_stored: Box::new(move |lap| stored.stored_lap(lap)),
        on_thread_start: process_priority::lower_current_thread,
    })));
    import::start(service, host);
}

fn open_db(app: &AppHandle) -> Result<StatsDb, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&config_dir).map_err(|error| error.to_string())?;

    StatsDb::open(&config_dir.join(STATS_DB_FILE))
}

/// `Documents\iRacing\telemetry`, through the known folder: Documents is often
/// moved to another drive.
fn session_file_folder(app: &AppHandle) -> Option<PathBuf> {
    Some(iracing_documents(app)?.join("telemetry"))
}

/// `Documents\iRacing\app.ini`, the sim's own settings.
pub fn sim_settings_file(app: &AppHandle) -> Option<PathBuf> {
    Some(iracing_documents(app)?.join("app.ini"))
}

fn iracing_documents(app: &AppHandle) -> Option<PathBuf> {
    Some(app.path().document_dir().ok()?.join("iRacing"))
}
