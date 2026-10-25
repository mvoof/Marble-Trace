//! A compact summary of the saved settings, written to the log file each time
//! the main window saves them: the layouts, which session each is assigned to,
//! and every enabled widget's frame and changed settings, per monitor.

use std::collections::HashMap;

use serde_json::{json, Value};

/// Verbose diagnostics (full widget/settings dumps) are tagged with this
/// target so they can be routed to the log file without flooding the
/// dev console, which should only show basic lifecycle lines.
pub const SETTINGS_SNAPSHOT_TARGET: &str = "marble_trace_lib::settings_snapshot";

fn summarize_enabled_widgets(widgets: &Value) -> Vec<String> {
    let Some(widgets) = widgets.as_array() else {
        return Vec::new();
    };

    widgets
        .iter()
        .filter_map(|widget| {
            let id = widget.get("id").and_then(|id| id.as_str())?;

            let enabled = widget
                .get("enabled")
                .and_then(|enabled| enabled.as_bool())
                .unwrap_or(false);

            if !enabled {
                return None;
            }

            let summary = json!({
                "frame": widget.get("frame"),
                "settings": widget.get("settings"),
            });
            let summary_json = serde_json::to_string(&summary).unwrap_or_default();

            Some(format!("{id}={summary_json}"))
        })
        .collect()
}

fn sessions_by_layout_id(session_layouts: Option<&Value>) -> HashMap<&str, Vec<&str>> {
    let mut sessions: HashMap<&str, Vec<&str>> = HashMap::new();

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
    layout: &Value,
    active_layout_id: Option<&str>,
    sessions_by_layout_id: &HashMap<&str, Vec<&str>>,
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

    // Each monitor holds its own widgets (settings schema v6), and a widget
    // stores only the settings that differ from the shipped defaults.
    let widgets: Vec<String> = layout
        .get("monitors")
        .and_then(|monitors| monitors.as_array())
        .map(|monitors| {
            monitors
                .iter()
                .map(|monitor| {
                    let monitor_name = monitor
                        .get("name")
                        .and_then(|name| name.as_str())
                        .unwrap_or("unnamed");
                    let widgets = monitor
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
/// which session context each is assigned to, and the frame and changed
/// settings of every enabled widget, per monitor — to the log file. Tagged under
/// [`SETTINGS_SNAPSHOT_TARGET`] so it never floods the dev console.
pub fn log_settings_snapshot(settings: &Value) {
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
