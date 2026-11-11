//! The editor's listening and preview buttons: what a variant or a question
//! sounds like, and the test press.

use std::sync::mpsc::sync_channel;
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, State};

use mt_model::app::voice::{VoicePackView, VoiceQuestionPreview};
use mt_telemetry::control::TelemetryCommand;
use mt_telemetry::state::TelemetryState;
use mt_voice::crew::{pack_folder, preview_intent};
use mt_voice::engines::known_language;
use mt_voice::pack::editor::{draft_vosk_grammar, with_draft_questions};
use mt_voice::pack::load;
use mt_voice::preview::{line_preview, reply_utterances};

use super::current_config;
use crate::voice::{voice_root, VoiceCrewState};

/// How long a question's preview waits for the telemetry thread: it answers
/// on its next tick, so past this no session is running.
const PREVIEW_WAIT: Duration = Duration::from_millis(500);

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
    let utterance = line_preview(&pack, &key, index)?;

    state.crew().preview(utterance);

    Ok(())
}

/// What a question of the draft would answer now, from the session the app is
/// connected to; `play` says it as well. `car`: the number or place its
/// phrase's slot would hear. Its steps are never carried out.
#[tauri::command]
pub async fn preview_voice_question(
    app: AppHandle,
    state: State<'_, Arc<VoiceCrewState>>,
    telemetry: State<'_, TelemetryState>,
    pack: VoicePackView,
    question: String,
    car: Option<String>,
    play: bool,
) -> Result<VoiceQuestionPreview, String> {
    let language = known_language(&pack.language);
    let folder = pack_folder(&voice_root(&app)?, &language);
    let draft = with_draft_questions(load(&language, Some(&folder)), &pack, &question);
    let Some(intent) = preview_intent(&draft, &question, car.as_deref()) else {
        return Ok(VoiceQuestionPreview::NeedsCar);
    };
    let (sender, answered) = sync_channel(1);

    telemetry.service.send(TelemetryCommand::CrewPreview {
        intent,
        answer: sender,
    });

    let replies = tauri::async_runtime::spawn_blocking(move || answered.recv_timeout(PREVIEW_WAIT))
        .await
        .map_err(|error| error.to_string())?;
    let Ok(replies) = replies else {
        return Ok(VoiceQuestionPreview::NoSession);
    };
    let units = state.crew().units();
    let utterances = reply_utterances(&draft, units, &replies);

    if utterances.is_empty() {
        return Ok(VoiceQuestionPreview::Silent);
    }

    let texts = utterances
        .iter()
        .map(|utterance| utterance.text.clone())
        .collect();

    if play {
        let crew = state.crew();

        for utterance in utterances {
            crew.preview(utterance);
        }
    }

    Ok(VoiceQuestionPreview::Said { texts })
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
