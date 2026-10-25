use std::path::{Path, PathBuf};
use tauri::{App, Manager};
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer};

use crate::settings_snapshot::SETTINGS_SNAPSHOT_TARGET;

/// Keeps the non-blocking file writer alive for the process lifetime.
/// Dropping it would silently stop flushing log lines to disk.
pub struct LogFileGuard(#[allow(dead_code)] WorkerGuard);

const LOG_FILE_NAME: &str = "marble-trace.log";
const PREVIOUS_LOG_FILE_NAME: &str = "marble-trace.log.old";

/// Rotates the previous session's log out of the way so each run starts with
/// a fresh file. Only the current and immediately previous session are ever
/// kept on disk, so repeated launches never accumulate log files.
///
/// Returns whether the previous log was successfully rotated out of the way.
/// If rotation fails (e.g. the file is locked), the caller must not truncate
/// `current`, since that would discard the previous session's log content.
fn rotate_log_file(log_dir: &Path) -> (PathBuf, bool) {
    let current = log_dir.join(LOG_FILE_NAME);
    let previous = log_dir.join(PREVIOUS_LOG_FILE_NAME);

    let rotated = if current.exists() {
        std::fs::rename(&current, &previous).is_ok()
    } else {
        true
    };

    (current, rotated)
}

/// Every crate of the workspace at `info`. A tracing target is the module path,
/// and a directive matches every target that starts with it, so `mt_` covers
/// each `mt-*` crate, a new one included.
const DEFAULT_DIRECTIVES: &str = "marble_trace_lib=info,mt_=info";

fn build_env_filter(default_directives: &str) -> EnvFilter {
    EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(default_directives))
}

pub fn init(app: &App) -> LogFileGuard {
    let log_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("logs");
    let _ = std::fs::create_dir_all(&log_dir);
    let (log_file_path, rotated) = rotate_log_file(&log_dir);

    let log_file = if rotated {
        std::fs::File::create(&log_file_path)
    } else {
        std::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(&log_file_path)
    };

    let (non_blocking, guard) = match log_file {
        Ok(file) => tracing_appender::non_blocking(file),
        Err(error) => {
            eprintln!("Failed to initialize file logging: {error}");
            tracing_appender::non_blocking(std::io::sink())
        }
    };

    let stdout_layer = fmt::layer().with_filter(build_env_filter(&format!(
        "{DEFAULT_DIRECTIVES},{SETTINGS_SNAPSHOT_TARGET}=off"
    )));
    let file_layer = fmt::layer()
        .with_ansi(false)
        .with_writer(non_blocking)
        .with_filter(build_env_filter(DEFAULT_DIRECTIVES));

    let _ = tracing_subscriber::registry()
        .with(stdout_layer)
        .with(file_layer)
        .try_init();

    tracing::info!("===== SESSION START =====");
    tracing::info!(log_dir = %log_dir.display(), "file logging initialized");

    LogFileGuard(guard)
}

/// Routes every panic through `tracing` before the default hook prints it.
///
/// A panic in a worker thread (telemetry, input poll, perf run) otherwise only
/// ends that thread: the overlay freezes and a release build, with no console,
/// leaves nothing in the log to explain why.
pub fn install_panic_hook() {
    let default_hook = std::panic::take_hook();

    std::panic::set_hook(Box::new(move |info| {
        let thread = std::thread::current();
        let thread_name = thread.name().unwrap_or("unnamed");

        tracing::error!(thread = thread_name, panic = %info, "panic");
        default_hook(info);
    }));
}

pub fn log_startup_info(app: &App) {
    let version = app.package_info().version.to_string();
    let locale = sys_locale::get_locale().unwrap_or_else(|| "unknown".to_string());

    tracing::info!(
        version,
        os = std::env::consts::OS,
        arch = std::env::consts::ARCH,
        locale,
        "marble-trace starting"
    );

    log_displays(app);
}

fn log_displays(app: &App) {
    let primary_position = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|monitor| *monitor.position());

    let monitors = match app.available_monitors() {
        Ok(monitors) => monitors,
        Err(error) => {
            tracing::warn!(%error, "failed to enumerate displays");

            return;
        }
    };

    for (index, monitor) in monitors.iter().enumerate() {
        let size = monitor.size();
        let position = monitor.position();
        let is_primary = primary_position == Some(*position);

        tracing::info!(
            index,
            name = monitor.name().map(String::as_str).unwrap_or("unknown"),
            is_primary,
            width = size.width,
            height = size.height,
            scale_factor = monitor.scale_factor(),
            dpi = (96.0 * monitor.scale_factor()) as u32,
            position_x = position.x,
            position_y = position.y,
            "display detected"
        );
    }
}
