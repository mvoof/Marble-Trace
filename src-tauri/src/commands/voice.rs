//! The voice crew: its settings, pushed by the main window, and everything the
//! Crew tab does — downloads, the pack editor, test presses.

use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tauri::{AppHandle, State};
use tracing::{info, warn};

use mt_model::app::crew::VoiceCrewSettings;
use mt_model::app::voice::{
    AudioDeviceView, VoiceComponentState, VoiceComponentView, VoiceDownloadProgress,
    VoiceDraftCheck, VoicePackView, VoiceRecognisedView, VoiceStatus,
};
use mt_model::contract::event_sink::EventSink;
use mt_model::contract::events::EVENT_CREW_DOWNLOAD;
use mt_voice::assets::catalog::{catalog, Component, ComponentKind};
use mt_voice::assets::VoiceAssets;
use mt_voice::cache::{generate, missing_lines};
use mt_voice::capture::input_devices;
use mt_voice::crew::{output_config, pack_folder, CrewConfig};
use mt_voice::folder::move_folder;
use mt_voice::pack::catalog::reply_values_in;
use mt_voice::pack::editor::{
    check_draft, draft_vosk_grammar, pack_view, recognise_draft, save_pack,
};
use mt_voice::pack::message::{Arg, Args};
use mt_voice::pack::{load, BUILT_IN_LANGUAGES};
use mt_voice::pack_files::{export_pack, import_pack};
use mt_voice::playback::{output_devices, AudioDevice};
use mt_voice::voice_out::Utterance;

use crate::sink::TauriSink;
use crate::voice::{default_voice_root, voice_root, VoiceCrewState};

const FALLBACK_LANGUAGE: &str = "en";
const MIN_SPEED: f32 = 0.5;
const MAX_SPEED: f32 = 2.0;
/// Progress is sent at most this often — a download is thousands of chunks.
const PROGRESS_INTERVAL: Duration = Duration::from_millis(200);
/// What a phrase's numbers read as when it is played in the editor.
const PREVIEW_NUMBER: f64 = 12.0;
const COMPOUND_VALUE: &str = "compound";
const PREVIEW_COMPOUND: &str = "dry";

/// Applies the crew's settings: starts, reconfigures or stops the voice. Sent
/// on every change and once after the settings are read.
#[tauri::command]
pub async fn configure_voice_crew(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    settings: VoiceCrewSettings,
) -> Result<(), String> {
    let numbers = [
        settings.volume,
        settings.speed,
        settings.confidence_threshold,
    ];

    if numbers.iter().any(|number| !number.is_finite()) {
        return Err("Voice settings must be finite".to_string());
    }

    state.set_folder(chosen_folder(&settings.folder)?);

    let language = known_language(&settings.language);
    let voice = if settings.voice.is_empty() {
        recommended_voice(&language)
    } else {
        settings.voice.clone()
    };
    state.configure(CrewConfig {
        enabled: settings.enabled,
        language,
        voice_root: voice_root(&app)?,
        voice,
        input_device: settings.input_device.filter(|device| !device.is_empty()),
        output_device: settings.output_device.filter(|device| !device.is_empty()),
        volume: settings.volume.clamp(0.0, 1.0),
        // Piper's length scale is the inverse of a speed: 2 speaks at half pace.
        length_scale: 1.0 / settings.speed.clamp(MIN_SPEED, MAX_SPEED),
        confidence_threshold: settings.confidence_threshold.clamp(0.0, 1.0),
    });

    Ok(())
}

/// The folder the settings name: `None` for the app's own, an error for one
/// that is not a full path.
fn chosen_folder(folder: &str) -> Result<Option<PathBuf>, String> {
    let folder = folder.trim();

    if folder.is_empty() {
        return Ok(None);
    }

    let path = PathBuf::from(folder);

    if !path.is_absolute() {
        return Err(format!("Voice folder must be a full path: {folder}"));
    }

    Ok(Some(path))
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

    let stopped = disabled(state.crew().config());

    state.configure(stopped);

    tauri::async_runtime::spawn_blocking(move || move_folder(&from, &to))
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
}

fn known_language(language: &str) -> String {
    if BUILT_IN_LANGUAGES.contains(&language) {
        language.to_string()
    } else {
        FALLBACK_LANGUAGE.to_string()
    }
}

fn recommended_voice(language: &str) -> String {
    catalog()
        .recommended_for(language)
        .into_iter()
        .find(|component| component.kind == ComponentKind::TtsVoice)
        .map(|component| component.id.clone())
        .unwrap_or_default()
}

/// The downloads and their state, the imported voices, the audio devices.
#[tauri::command]
pub async fn voice_status(app: AppHandle) -> Result<VoiceStatus, String> {
    let root = voice_root(&app)?;
    let assets = VoiceAssets::new(&root);
    let components = catalog()
        .components
        .iter()
        .map(|component| component_view(&assets, component))
        .collect();
    let custom_voices = assets
        .custom_voices()
        .into_iter()
        .map(|voice| voice.name)
        .collect();
    // Device enumeration talks to the audio service and can take a moment.
    let (inputs, outputs) = tauri::async_runtime::spawn_blocking(|| {
        (
            device_views(input_devices()),
            device_views(output_devices()),
        )
    })
    .await
    .map_err(|error| error.to_string())?;

    Ok(VoiceStatus {
        voice_folder: root.to_string_lossy().into_owned(),
        components,
        custom_voices,
        inputs,
        outputs,
    })
}

fn component_view(assets: &VoiceAssets, component: &Component) -> VoiceComponentView {
    let state = if assets.is_installed(component) {
        VoiceComponentState::Installed
    } else if assets.is_outdated(component) {
        VoiceComponentState::Outdated
    } else {
        VoiceComponentState::Missing
    };
    let kind = match component.kind {
        ComponentKind::TtsEngine => "ttsEngine",
        ComponentKind::SttEngine => "sttEngine",
        ComponentKind::TtsVoice => "ttsVoice",
        ComponentKind::SttModel => "sttModel",
    };

    VoiceComponentView {
        id: component.id.clone(),
        kind: kind.to_string(),
        language: component.language.clone(),
        title: component.title.clone(),
        license: component.license.clone(),
        license_url: component.license_url.clone(),
        size_bytes: component.size() as f64,
        recommended: component.recommended,
        sample_url: component.sample.clone(),
        state,
    }
}

fn device_views(devices: Vec<AudioDevice>) -> Vec<AudioDeviceView> {
    devices
        .into_iter()
        .map(|device| AudioDeviceView {
            id: device.id,
            name: device.name,
            is_default: device.is_default,
        })
        .collect()
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
    let previous = release_engines(&state);
    let removed = VoiceAssets::new(voice_root(&app)?).remove_custom_voice(&name);

    restore_engines(&state, previous);

    removed.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn remove_voice_component(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    id: String,
) -> Result<(), String> {
    catalog_component(&id)?;

    let previous = release_engines(&state);
    let removed = VoiceAssets::new(voice_root(&app)?).remove(&id);

    restore_engines(&state, previous);

    removed.map_err(|error| error.to_string())
}

/// The engines are open while the crew runs; a removal lets go of them first
/// and hands back the settings to restart with.
fn release_engines(state: &VoiceCrewState) -> Option<CrewConfig> {
    let mut crew = state.crew();
    let previous = crew.config().cloned();

    crew.configure(disabled(previous.as_ref()));

    previous
}

/// Restarts the crew as it was before `release_engines`, with whatever is
/// still installed.
fn restore_engines(state: &VoiceCrewState, previous: Option<CrewConfig>) {
    if let Some(config) = previous {
        state.crew().configure(config);
    }
}

/// The crew's settings with the voice switched off, to release the engines.
fn disabled(config: Option<&CrewConfig>) -> CrewConfig {
    match config {
        Some(config) => CrewConfig {
            enabled: false,
            ..config.clone()
        },
        None => CrewConfig {
            enabled: false,
            language: FALLBACK_LANGUAGE.to_string(),
            voice_root: PathBuf::new(),
            voice: String::new(),
            input_device: None,
            output_device: None,
            volume: 1.0,
            length_scale: 1.0,
            confidence_threshold: 0.0,
        },
    }
}

/// What the tab's own actions run with: the crew's settings for `language`,
/// over the app's voice folder even before the first push.
fn current_config(
    app: &AppHandle,
    state: &VoiceCrewState,
    language: &str,
) -> Result<CrewConfig, String> {
    let root = voice_root(app)?;
    let base = disabled(state.crew().config());
    let voice = if base.voice.is_empty() || base.language != language {
        recommended_voice(language)
    } else {
        base.voice.clone()
    };

    Ok(CrewConfig {
        voice,
        voice_root: root,
        language: language.to_string(),
        ..base
    })
}

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

/// Plays one variant now, its values filled with samples.
#[tauri::command]
pub async fn preview_voice_line(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    language: String,
    key: String,
    index: u32,
) -> Result<(), String> {
    let language = known_language(&language);
    let config = current_config(&app, &state, &language)?;
    let pack = load(&language, Some(&pack_folder(&config.voice_root, &language)));
    let variant = pack
        .variants(&key)
        .get(index as usize)
        .ok_or("that variant has a mistake in it")?;
    // Played again, a variant with choices is heard another way.
    let saying = variant.any_saying();
    let compound = pack
        .slot_word(COMPOUND_VALUE, PREVIEW_COMPOUND)
        .unwrap_or(PREVIEW_COMPOUND)
        .to_string();
    let values = reply_values_in(&key, &saying.message);
    let args: Args<'_> = values
        .iter()
        .map(|value| {
            let sample = if value == COMPOUND_VALUE {
                Arg::Text(compound.clone())
            } else {
                Arg::Number(PREVIEW_NUMBER)
            };

            (value.as_str(), sample)
        })
        .collect();
    let text = pack.text(saying, &args).ok_or("the line does not format")?;
    state.crew().preview(Utterance { text });

    Ok(())
}

/// The Crew tab's test button: listens, reports, carries nothing out. With
/// the pack being edited, listens for its sentences, saved or not.
#[tauri::command]
pub async fn voice_test_ptt(
    state: State<'_, Arc<VoiceCrewState>>,
    held: bool,
    draft: Option<VoicePackView>,
) -> Result<(), String> {
    let draft_grammar = draft.as_ref().map(draft_vosk_grammar);

    state.crew().set_test_ptt(held, draft_grammar);

    Ok(())
}

#[tauri::command]
pub async fn export_voice_pack(
    app: AppHandle,
    language: String,
    path: String,
) -> Result<(), String> {
    let folder = pack_folder(&voice_root(&app)?, &known_language(&language));

    export_pack(&folder, Path::new(&path)).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn import_voice_pack(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    language: String,
    path: String,
) -> Result<(), String> {
    let folder = pack_folder(&voice_root(&app)?, &known_language(&language));

    import_pack(Path::new(&path), &folder).map_err(|error| error.to_string())?;
    state.crew().reload();

    Ok(())
}
