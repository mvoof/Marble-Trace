//! Frontend entry points for the hotkey dispatcher.
//!
//! All `async`: a synchronous command runs on the main thread, and registering
//! a shortcut waits for that same thread.

use tauri::{AppHandle, State};

use crate::model::hotkeys::{HotkeyContext, OverlayModes};

use super::dispatch::BindingMap;
use super::runtime::{self, HotkeyState};

/// The effective binding map — defaults with the user's overrides on top —
/// pushed by the main window whenever it changes.
#[tauri::command]
pub async fn set_hotkey_bindings(app: AppHandle, bindings: BindingMap) -> Result<(), String> {
    runtime::set_bindings(&app, bindings);

    Ok(())
}

/// The layout gate and the interact key's settings, pushed by the main window.
#[tauri::command]
pub async fn set_hotkey_context(app: AppHandle, context: HotkeyContext) -> Result<(), String> {
    if !context.interact_auto_off_seconds.is_finite() {
        return Err("Interact auto-off must be a finite number of seconds".to_string());
    }

    runtime::set_context(&app, context);

    Ok(())
}

/// The drag mode switch in the settings and the overlay's done button.
#[tauri::command]
pub async fn set_drag_mode(app: AppHandle, enabled: bool) -> Result<(), String> {
    runtime::set_drag_mode(&app, enabled);

    Ok(())
}

#[tauri::command]
pub async fn set_interact_mode(app: AppHandle, enabled: bool) -> Result<(), String> {
    runtime::set_interact_mode(&app, enabled);

    Ok(())
}

/// For a window that has just loaded and missed the last broadcast.
#[tauri::command]
pub async fn get_overlay_modes(state: State<'_, HotkeyState>) -> Result<OverlayModes, String> {
    Ok(state.modes())
}
