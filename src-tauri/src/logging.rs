use std::path::{Path, PathBuf};
use tauri::{App, Manager};
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer};

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

/// Verbose diagnostics (full widget/settings dumps) are tagged with this
/// target so they can be routed to the log file without flooding the
/// dev console, which should only show basic lifecycle lines.
pub const SETTINGS_SNAPSHOT_TARGET: &str = "marble_trace_lib::settings_snapshot";

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
        "marble_trace_lib=info,{SETTINGS_SNAPSHOT_TARGET}=off"
    )));
    let file_layer = fmt::layer()
        .with_ansi(false)
        .with_writer(non_blocking)
        .with_filter(build_env_filter("marble_trace_lib=info"));

    let _ = tracing_subscriber::registry()
        .with(stdout_layer)
        .with(file_layer)
        .try_init();

    tracing::info!("===== SESSION START =====");
    tracing::info!(log_dir = %log_dir.display(), "file logging initialized");

    LogFileGuard(guard)
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

fn summarize_enabled_widgets(widgets: &serde_json::Value) -> Vec<String> {
    let Some(widgets) = widgets.as_array() else {
        return Vec::new();
    };

    widgets
        .iter()
        .filter_map(|widget| {
            let id = widget.get("id").and_then(|id| id.as_str())?;
            let user_settings = widget.get("userSettings")?;

            let enabled = user_settings
                .get("enabled")
                .and_then(|enabled| enabled.as_bool())
                .unwrap_or(true);

            if !enabled {
                return None;
            }

            let settings_json = serde_json::to_string(user_settings).unwrap_or_default();

            Some(format!("{id}={settings_json}"))
        })
        .collect()
}

fn sessions_by_layout_id(
    session_layouts: Option<&serde_json::Value>,
) -> std::collections::HashMap<&str, Vec<&str>> {
    let mut sessions: std::collections::HashMap<&str, Vec<&str>> = std::collections::HashMap::new();

    if let Some(map) = session_layouts.and_then(|value| value.as_object()) {
        for (context, layout_id) in map {
            if let Some(layout_id) = layout_id.as_str() {
                sessions
                    .entry(layout_id)
                    .or_default()
                    .push(context.as_str());
            }
        }
    }

    sessions
}

fn summarize_layout(
    layout: &serde_json::Value,
    active_layout_id: Option<&str>,
    sessions_by_layout_id: &std::collections::HashMap<&str, Vec<&str>>,
) -> String {
    let name = layout
        .get("name")
        .and_then(|name| name.as_str())
        .unwrap_or("unnamed");
    let layout_id = layout.get("id").and_then(|id| id.as_str());
    let is_active = layout_id == active_layout_id;

    let sessions = layout_id
        .and_then(|id| sessions_by_layout_id.get(id))
        .map(|contexts| contexts.join(", "))
        .unwrap_or_default();

    let widgets: Vec<String> = layout
        .get("monitorConfigs")
        .and_then(|configs| configs.as_object())
        .map(|configs| {
            configs
                .iter()
                .map(|(monitor_name, config)| {
                    let widgets = config
                        .get("widgets")
                        .map(summarize_enabled_widgets)
                        .unwrap_or_default();

                    format!("{monitor_name}=[{}]", widgets.join(", "))
                })
                .collect()
        })
        .unwrap_or_default();

    format!(
        "{name}{} (sessions: {}) {}",
        if is_active { "*" } else { "" },
        if sessions.is_empty() {
            "none"
        } else {
            &sessions
        },
        widgets.join(", ")
    )
}

/// Logs a compact but complete summary of persisted settings — active layouts,
/// which session context each is assigned to, and the full userSettings for
/// every enabled widget — to the log file. Tagged under
/// [`SETTINGS_SNAPSHOT_TARGET`] so it never floods the dev console.
pub fn log_settings_snapshot(settings: &serde_json::Value) {
    let app = settings.get("app");
    let active_layout_id = settings.get("activeLayoutId").and_then(|id| id.as_str());

    let sessions_by_layout_id = sessions_by_layout_id(settings.get("sessionLayouts"));

    let layouts = settings
        .get("layouts")
        .and_then(|layouts| layouts.as_array())
        .map(|layouts| {
            layouts
                .iter()
                .map(|layout| summarize_layout(layout, active_layout_id, &sessions_by_layout_id))
                .collect::<Vec<_>>()
                .join(" | ")
        })
        .unwrap_or_default();

    let units = settings
        .get("units")
        .and_then(|units| units.get("system"))
        .and_then(|system| system.as_str())
        .unwrap_or("unknown");
    let drag_hotkey = app
        .and_then(|app| app.get("dragHotkey"))
        .and_then(|value| value.as_str())
        .unwrap_or("unknown");
    let hide_all_widgets_hotkey = app
        .and_then(|app| app.get("hideAllWidgetsHotkey"))
        .and_then(|value| value.as_str())
        .unwrap_or("unknown");
    let hide_all_widgets = app
        .and_then(|app| app.get("hideAllWidgets"))
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let hide_widgets_when_game_closed = app
        .and_then(|app| app.get("hideWidgetsWhenGameClosed"))
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let auto_switch_layouts = app
        .and_then(|app| app.get("autoSwitchLayouts"))
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let auto_update = app
        .and_then(|app| app.get("autoUpdate"))
        .and_then(|value| value.as_bool())
        .unwrap_or(false);

    tracing::info!(
        target: SETTINGS_SNAPSHOT_TARGET,
        layouts,
        units,
        drag_hotkey,
        hide_all_widgets_hotkey,
        hide_all_widgets,
        hide_widgets_when_game_closed,
        auto_switch_layouts,
        auto_update,
        "settings saved"
    );
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
