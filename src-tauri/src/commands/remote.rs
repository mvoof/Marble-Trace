//! The remote-widgets server's commands. Thin wrappers: the server's lifetime
//! is `remote::control`'s, everything it broadcasts comes from the hub.

use tauri::State;

use mt_model::app::remote::{RemoteDevice, RemoteServerConfig, RemoteServerInfo};
use mt_remote::control::{self, RemoteState};
use mt_remote::server::RemoteHost;

#[tauri::command]
pub async fn start_remote_server(
    host: State<'_, RemoteHost>,
    state: State<'_, RemoteState>,
    config: RemoteServerConfig,
) -> Result<RemoteServerInfo, String> {
    // Cloning the host clones its `Arc`s, never the `AppHandle` inside them.
    control::start(host.inner().clone(), &state, config).await
}

#[tauri::command]
pub async fn stop_remote_server(state: State<'_, RemoteState>) -> Result<(), String> {
    control::stop_and_wait(&state).await;

    Ok(())
}

#[tauri::command]
pub async fn get_remote_server_info(
    state: State<'_, RemoteState>,
) -> Result<RemoteServerInfo, String> {
    Ok(state.info(control::lan_mode()))
}

/// What the connected devices report about their own displays. Read by the
/// settings UI to offer matching a screen's size to the real one.
#[tauri::command]
pub async fn get_remote_devices(
    state: State<'_, RemoteState>,
) -> Result<Vec<RemoteDevice>, String> {
    Ok(state.hub.devices())
}

/// The main window pushes one snapshot per remote screen — the widgets of that
/// screen plus whatever app-level settings they read. The backend never parses
/// it; it only caches and forwards.
#[tauri::command]
pub async fn publish_remote_snapshot(
    state: State<'_, RemoteState>,
    slug: String,
    snapshot: serde_json::Value,
) -> Result<(), String> {
    state.hub.publish_snapshot(slug, snapshot);

    Ok(())
}

/// A hotkey pressed in the main window reaches the overlay windows as a Tauri
/// event; this is the same command on its way to a browser instead.
#[tauri::command]
pub async fn publish_remote_control(
    state: State<'_, RemoteState>,
    kind: String,
    data: serde_json::Value,
) -> Result<(), String> {
    state.hub.publish_control(&kind, data);

    Ok(())
}

#[tauri::command]
pub async fn remote_screen_url(
    state: State<'_, RemoteState>,
    slug: String,
) -> Result<String, String> {
    Ok(control::screen_address(&state, &slug))
}
