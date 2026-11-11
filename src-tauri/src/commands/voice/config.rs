//! The crew's settings and the folder they name.

use std::sync::Arc;

use tauri::{AppHandle, State};

use mt_model::app::crew::VoiceCrewSettings;
use mt_voice::engines::{checked_folder, chosen_folder, config_from_settings, disabled_config};
use mt_voice::folder::move_folder;

use crate::voice::{default_voice_root, voice_root, VoiceCrewState};

/// Applies the crew's settings: starts, reconfigures or stops the voice. Sent
/// on every change and once after the settings are read.
#[tauri::command]
pub async fn configure_voice_crew(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    settings: VoiceCrewSettings,
) -> Result<(), String> {
    state.set_folder(checked_folder(&settings)?);
    state.configure(config_from_settings(&settings, voice_root(&app)?));

    Ok(())
}

/// Moves the voice folder's contents to `folder` (empty: the app's own),
/// the crew stopped meanwhile so nothing in it is held open. The new place is
/// taken into use when the settings naming it are pushed.
#[tauri::command]
pub async fn move_voice_folder(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    folder: String,
) -> Result<(), String> {
    let from = voice_root(&app)?;
    let to = match chosen_folder(&folder)? {
        Some(path) => path,
        None => default_voice_root(&app)?,
    };

    if from == to {
        return Ok(());
    }

    let stopped = disabled_config(state.crew().config());

    state.configure(stopped);

    tauri::async_runtime::spawn_blocking(move || move_folder(&from, &to))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}
