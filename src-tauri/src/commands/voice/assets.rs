//! The Crew tab's downloads, imported files and installed voices.

use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tauri::{AppHandle, State};
use tracing::{info, warn};

use mt_model::app::voice::{VoiceDownloadProgress, VoiceStatus};
use mt_model::contract::event_sink::EventSink;
use mt_model::contract::events::EVENT_CREW_DOWNLOAD;
use mt_voice::assets::catalog::{catalog, Component};
use mt_voice::assets::VoiceAssets;
use mt_voice::capture::input_devices;
use mt_voice::playback::output_devices;
use mt_voice::views::status_view;

use crate::sink::TauriSink;
use crate::voice::{voice_root, VoiceCrewState};

/// Progress is sent at most this often — a download is thousands of chunks.
const PROGRESS_INTERVAL: Duration = Duration::from_millis(200);

/// The downloads and their state, the imported voices, the audio devices.
#[tauri::command]
pub async fn voice_status(app: AppHandle) -> Result<VoiceStatus, String> {
    let root = voice_root(&app)?;
    // Device enumeration talks to the audio service and can take a moment.
    let (inputs, outputs) =
        tauri::async_runtime::spawn_blocking(|| (input_devices(), output_devices()))
            .await
            .map_err(|error| error.to_string())?;

    Ok(status_view(&root, inputs, outputs))
}

fn catalog_component(id: &str) -> Result<&'static Component, String> {
    catalog()
        .component(id)
        .ok_or_else(|| format!("{id} is not in the voice catalog"))
}

/// Downloads one component, reporting on `crew://download`, and reloads the
/// crew so a freshly installed engine is used at once.
#[tauri::command]
pub async fn install_voice_component(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    id: String,
) -> Result<(), String> {
    let component = catalog_component(&id)?;
    let assets = VoiceAssets::new(voice_root(&app)?);
    let sink: Arc<dyn EventSink> = Arc::new(TauriSink(app.clone()));
    let total = component.size() as f64;
    let mut last_sent: Option<Instant> = None;

    state.cancel_download.store(false, Ordering::Relaxed);
    info!(component = %id, "voice download");

    let result = assets
        .install(
            &state.client,
            component,
            &state.cancel_download,
            |progress| {
                if last_sent.is_none_or(|sent| sent.elapsed() >= PROGRESS_INTERVAL) {
                    last_sent = Some(Instant::now());
                    send_progress(sink.as_ref(), &id, progress.done as f64, total, false, None);
                }
            },
        )
        .await
        .map_err(|error| error.to_string());

    match &result {
        Ok(()) => send_progress(sink.as_ref(), &id, total, total, true, None),
        Err(error) => {
            warn!(component = %id, %error, "voice download failed");
            send_progress(sink.as_ref(), &id, 0.0, total, true, Some(error.clone()));
        }
    }

    state.crew().reload();

    result
}

fn send_progress(
    sink: &dyn EventSink,
    component: &str,
    done: f64,
    total: f64,
    finished: bool,
    error: Option<String>,
) {
    let progress = VoiceDownloadProgress {
        component: component.to_string(),
        done_bytes: done,
        total_bytes: total,
        finished,
        error,
    };

    if let Err(error) = sink.emit(EVENT_CREW_DOWNLOAD, &progress) {
        warn!(%error, "voice download progress not delivered");
    }
}

#[tauri::command]
pub async fn cancel_voice_download(state: State<'_, Arc<VoiceCrewState>>) -> Result<(), String> {
    state.cancel_download.store(true, Ordering::Relaxed);

    Ok(())
}

/// A component's files downloaded elsewhere, recognised by their hashes.
#[tauri::command]
pub async fn import_voice_files(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    id: String,
    paths: Vec<String>,
) -> Result<(), String> {
    let component = catalog_component(&id)?;
    let assets = VoiceAssets::new(voice_root(&app)?);
    let paths: Vec<PathBuf> = paths.into_iter().map(PathBuf::from).collect();

    tauri::async_runtime::spawn_blocking(move || assets.import_files(component, &paths))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())?;
    state.crew().reload();

    Ok(())
}

/// A Piper voice of the user's own; returns its name.
#[tauri::command]
pub async fn import_custom_voice(app: AppHandle, path: String) -> Result<String, String> {
    let assets = VoiceAssets::new(voice_root(&app)?);

    assets
        .import_custom_voice(Path::new(&path))
        .map(|voice| voice.name)
        .map_err(|error| error.to_string())
}

/// Every Piper voice in a folder and under it; returns their names.
#[tauri::command]
pub async fn import_custom_voice_folder(
    app: AppHandle,
    path: String,
) -> Result<Vec<String>, String> {
    let assets = VoiceAssets::new(voice_root(&app)?);

    tauri::async_runtime::spawn_blocking(move || {
        assets.import_custom_voice_folder(Path::new(&path))
    })
    .await
    .map_err(|error| error.to_string())?
    .map(|voices| voices.into_iter().map(|voice| voice.name).collect())
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn remove_custom_voice(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    name: String,
) -> Result<(), String> {
    let previous = state.crew().release_engines();
    let removed = VoiceAssets::new(voice_root(&app)?).remove_custom_voice(&name);

    state.crew().restore_engines(previous);

    removed.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn remove_voice_component(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    id: String,
) -> Result<(), String> {
    catalog_component(&id)?;

    let previous = state.crew().release_engines();
    let removed = VoiceAssets::new(voice_root(&app)?).remove(&id);

    state.crew().restore_engines(previous);

    removed.map_err(|error| error.to_string())
}
