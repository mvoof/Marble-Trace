//! Frontend entry points for the hotkey dispatcher.
//!
//! All `async`: a synchronous command runs on the main thread, and registering
//! a shortcut waits for that same thread.

use std::sync::Arc;

use tauri::State;

use mt_hotkeys::dispatch::BindingMap;
use mt_hotkeys::runtime::HotkeyRuntime;
use mt_model::app::hotkeys::{HotkeyContext, OverlayModes};

/// The effective binding map — defaults with the user's overrides on top —
/// pushed by the main window whenever it changes.
#[tauri::command]
pub async fn set_hotkey_bindings(
    hotkeys: State<'_, Arc<HotkeyRuntime>>,
    bindings: BindingMap,
) -> Result<(), String> {
    hotkeys.set_bindings(bindings);

    Ok(())
}

/// The layout gate and the interact key's settings, pushed by the main window.
#[tauri::command]
pub async fn set_hotkey_context(
    hotkeys: State<'_, Arc<HotkeyRuntime>>,
    context: HotkeyContext,
) -> Result<(), String> {
    if !context.interact_auto_off_seconds.is_finite() {
        return Err("Interact auto-off must be a finite number of seconds".to_string());
    }

    hotkeys.set_context(context);

    Ok(())
}

/// The drag mode switch in the settings and the overlay's done button.
#[tauri::command]
pub async fn set_drag_mode(
    hotkeys: State<'_, Arc<HotkeyRuntime>>,
    enabled: bool,
) -> Result<(), String> {
    hotkeys.set_drag_mode(enabled);

    Ok(())
}

#[tauri::command]
pub async fn set_interact_mode(
    hotkeys: State<'_, Arc<HotkeyRuntime>>,
    enabled: bool,
) -> Result<(), String> {
    hotkeys.set_interact_mode(enabled);

    Ok(())
}

/// For a window that has just loaded and missed the last broadcast.
#[tauri::command]
pub async fn get_overlay_modes(
    hotkeys: State<'_, Arc<HotkeyRuntime>>,
) -> Result<OverlayModes, String> {
    Ok(hotkeys.modes())
}
