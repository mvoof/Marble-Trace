//! The pack editor: reading, saving, checking, exporting and importing a
//! language's pack, and synthesising its lines.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;
use tracing::warn;

use mt_model::app::voice::{PackFileError, VoiceDraftCheck, VoicePackView, VoiceRecognisedView};
use mt_voice::cache::{generate, missing_lines};
use mt_voice::crew::{output_config, pack_folder};
use mt_voice::engines::{known_language, language_pack_folder};
use mt_voice::pack::editor::{check_draft, pack_view, recognise_draft, save_pack};
use mt_voice::pack::load;
use mt_voice::pack_files::{export_pack, import_pack};

use super::current_config;
use crate::voice::{voice_root, VoiceCrewState};

const SHEET_EXTENSION: &str = "html";

#[tauri::command]
pub async fn voice_pack(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    language: String,
) -> Result<VoicePackView, String> {
    let language = known_language(&language);
    let config = current_config(&app, &state, &language)?;
    let folder = pack_folder(&config.voice_root, &language);
    let pack = load(&language, Some(&folder));

    Ok(pack_view(&pack, &folder, &output_config(&config)))
}

/// Writes the edited pack and reloads the crew with it; returns it as read
/// back, with its new statuses, counts and mistakes.
#[tauri::command]
pub async fn save_voice_pack(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    pack: VoicePackView,
) -> Result<VoicePackView, String> {
    let language = known_language(&pack.language);
    let config = current_config(&app, &state, &language)?;
    let folder = pack_folder(&config.voice_root, &language);

    save_pack(&folder, &pack).map_err(|error| error.to_string())?;
    state.crew().reload();

    let reloaded = load(&language, Some(&folder));

    Ok(pack_view(&reloaded, &folder, &output_config(&config)))
}

/// The pack being edited, checked before it is saved — its words too, against
/// the recognition model the crew listens with.
#[tauri::command]
pub async fn check_voice_draft(
    state: State<'_, Arc<VoiceCrewState>>,
    pack: VoicePackView,
) -> Result<VoiceDraftCheck, String> {
    let lookup = state.crew().word_lookup(&pack.language);

    // The ear's thread may still be loading the model.
    tauri::async_runtime::spawn_blocking(move || check_draft(&pack, |words| lookup?.missing(words)))
        .await
        .map_err(|error| error.to_string())
}

/// The commands the pack being edited would hear in a typed sentence.
#[tauri::command]
pub async fn recognise_voice_sentence(
    pack: VoicePackView,
    sentence: String,
) -> Vec<VoiceRecognisedView> {
    recognise_draft(&pack, &sentence)
}

/// Synthesises every fixed line that has no sound yet; returns how many.
#[tauri::command]
pub async fn generate_voice_lines(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    language: String,
) -> Result<u32, String> {
    let language = known_language(&language);
    let config = current_config(&app, &state, &language)?;
    let output = output_config(&config);
    let pack = load(&language, Some(&pack_folder(&config.voice_root, &language)));
    let lines = missing_lines(&pack, &output);

    tauri::async_runtime::spawn_blocking(move || {
        let mut done = 0;

        generate(&lines, &output, |line, result| match result {
            Ok(()) => done += 1,
            Err(error) => warn!(%line, %error, "voice line not generated"),
        })
        .map(|()| done)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// The language's pack folder, the failure to find it said as a pack error.
fn pack_folder_for(app: &AppHandle, language: &str) -> Result<PathBuf, PackFileError> {
    let root = voice_root(app).map_err(|detail| PackFileError::Failed { detail })?;

    Ok(language_pack_folder(&root, language))
}

#[tauri::command]
pub async fn export_voice_pack(
    app: AppHandle,
    language: String,
    path: String,
) -> Result<(), PackFileError> {
    export_pack(&pack_folder_for(&app, &language)?, Path::new(&path))
}

#[tauri::command]
pub async fn import_voice_pack(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    language: String,
    path: String,
) -> Result<Vec<String>, PackFileError> {
    let switched_off = import_pack(Path::new(&path), &pack_folder_for(&app, &language)?)?;
    state.crew().reload();

    Ok(switched_off)
}

fn sheet_failed(error: impl ToString) -> PackFileError {
    PackFileError::Failed {
        detail: error.to_string(),
    }
}

/// Writes the commands sheet the page built from the saved pack and opens it
/// in the browser. Only an `.html` file: the page hands the path and the text.
/// The sheet is saved once written; a browser that does not open is logged,
/// not reported as a failed export.
#[tauri::command]
pub async fn export_voice_sheet(
    app: AppHandle,
    path: String,
    html: String,
) -> Result<(), PackFileError> {
    let path = PathBuf::from(path);
    let is_html = path
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case(SHEET_EXTENSION));

    if !is_html {
        return Err(sheet_failed(format!(
            "not an .{SHEET_EXTENSION} file: {}",
            path.display()
        )));
    }

    let written = path.clone();

    tauri::async_runtime::spawn_blocking(move || fs::write(&written, html))
        .await
        .map_err(sheet_failed)?
        .map_err(sheet_failed)?;

    if let Err(error) = app.opener().open_path(path.to_string_lossy(), None::<&str>) {
        warn!(path = %path.display(), %error, "voice sheet saved but not opened");
    }

    Ok(())
}
