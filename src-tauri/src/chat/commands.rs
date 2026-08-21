//! Tauri commands for the chat runtime.
//!
//! No command accepts or returns an OAuth token: they live in the OS credential
//! store and are read there by the runtime.

use tauri::{AppHandle, State};
use tracing::info;

use super::state::ChatState;
use super::{has_baked_client_id, helix, resolve_client_id, runtime, secrets};
use crate::model::chat::{ChatConfig, TwitchDeviceCode, TwitchTokenResult};

const NO_CLIENT_ID: &str = "no twitch client id available";

/// Applies a config and (re)connects. Called on startup and on every change to
/// the channel fields — restarting is cheap and keeps one code path.
#[tauri::command]
pub async fn start_chat_stream(
    app: AppHandle,
    state: State<'_, ChatState>,
    config: ChatConfig,
) -> Result<(), String> {
    runtime::start(app, state.service.clone(), config);

    Ok(())
}

#[tauri::command]
pub async fn stop_chat_stream(state: State<'_, ChatState>) -> Result<(), String> {
    runtime::stop(&state.service);

    Ok(())
}

/// True when the build carries a client id, so the UI knows whether to ask the
/// user to register their own application.
#[tauri::command]
pub fn twitch_has_client_id() -> bool {
    has_baked_client_id()
}

/// Step one of the device code flow — returns the code the user types in on
/// twitch.tv/activate.
#[tauri::command]
pub async fn twitch_request_device_code(
    client_id: Option<String>,
) -> Result<TwitchDeviceCode, String> {
    let client_id = resolve_client_id(client_id.as_deref()).ok_or(NO_CLIENT_ID)?;

    info!("requesting twitch device code");

    helix::request_device_code(&client_id).await
}

/// Step two — polled by the frontend until `authorized` flips to true. On
/// success the tokens are written to the credential store, not returned.
#[tauri::command]
pub async fn twitch_poll_device_token(
    client_id: Option<String>,
    device_code: String,
) -> Result<TwitchTokenResult, String> {
    let client_id = resolve_client_id(client_id.as_deref()).ok_or(NO_CLIENT_ID)?;

    helix::poll_device_token(&client_id, &device_code).await
}

/// Login of the stored token, or null when signed out or the token is dead.
/// Called on startup so the settings page can show the right state.
#[tauri::command]
pub async fn twitch_current_login(client_id: Option<String>) -> Result<Option<String>, String> {
    // Refresh-only is still signed in: the fall-through below mints a fresh
    // access token from it.
    if !secrets::has_credentials() {
        return Ok(None);
    }

    if let Some(login) = helix::current_login().await {
        return Ok(Some(login));
    }

    // Stored token is stale — try the refresh token before giving up, so an app
    // left closed overnight signs itself back in instead of nagging the user.
    let Some(client_id) = resolve_client_id(client_id.as_deref()) else {
        return Ok(None);
    };

    let refreshed = helix::refresh_stored_token(&client_id).await?;

    Ok(refreshed.login.filter(|_| refreshed.authorized))
}

#[tauri::command]
pub fn twitch_sign_out() {
    secrets::clear();

    info!("twitch credentials cleared");
}
