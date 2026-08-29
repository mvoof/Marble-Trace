//! The command surface for companion applications.

use tauri::State;

use crate::companions::{self, CompanionsState};
use crate::model::companions::{CompanionApp, CompanionStatus, DetectedApp};

/// Guards against a settings file that grew an implausible list by hand.
const MAX_COMPANION_APPS: usize = 32;

#[tauri::command]
pub fn detect_companion_apps() -> Vec<DetectedApp> {
    companions::detect()
}

#[tauri::command]
pub fn companion_app_statuses(
    apps: Vec<CompanionApp>,
    state: State<'_, CompanionsState>,
) -> Result<Vec<CompanionStatus>, String> {
    if apps.len() > MAX_COMPANION_APPS {
        return Err(format!(
            "at most {} companion apps are supported",
            MAX_COMPANION_APPS
        ));
    }

    Ok(companions::statuses(&apps, &state))
}

/// Starts the program. Returns false when it was already running, which is a
/// normal outcome rather than a failure.
#[tauri::command]
pub fn launch_companion_app(
    app: CompanionApp,
    state: State<'_, CompanionsState>,
) -> Result<bool, String> {
    companions::launch(&app, &state)
}

/// Closes the program, if this app is the one that started it.
#[tauri::command]
pub fn close_companion_app(
    app: CompanionApp,
    state: State<'_, CompanionsState>,
) -> Result<bool, String> {
    companions::close(&app, &state)
}

/// Closes everything marked to close with the app and waits for it to be gone.
/// Returns the names still running, which is how an elevated program reports
/// that an ordinary process cannot end it.
#[tauri::command]
pub fn close_companion_apps(
    apps: Vec<CompanionApp>,
    state: State<'_, CompanionsState>,
) -> Result<Vec<String>, String> {
    if apps.len() > MAX_COMPANION_APPS {
        return Err(format!(
            "at most {} companion apps are supported",
            MAX_COMPANION_APPS
        ));
    }

    Ok(companions::close_marked(&apps, &state))
}

/// The executable's own icon as a PNG data URL, or null when it has none.
#[tauri::command]
pub fn companion_app_icon(path: String) -> Option<String> {
    companions::icon::icon_data_url(&path)
}
