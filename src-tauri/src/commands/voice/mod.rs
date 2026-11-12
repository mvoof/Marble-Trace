//! The voice crew: its settings, pushed by the main window, and everything the
//! Crew tab does — downloads, the pack editor, test presses.

pub mod assets;
pub mod config;
pub mod pack;
pub mod preview;

use tauri::AppHandle;

use mt_voice::crew::CrewConfig;
use mt_voice::engines::config_for_language;

use crate::voice::{voice_root, VoiceCrewState};

/// What the tab's own actions run with: the crew's settings for `language`,
/// over the app's voice folder even before the first push.
pub(super) fn current_config(
    app: &AppHandle,
    state: &VoiceCrewState,
    language: &str,
) -> Result<CrewConfig, String> {
    Ok(config_for_language(
        state.crew().config(),
        voice_root(app)?,
        language,
    ))
}
