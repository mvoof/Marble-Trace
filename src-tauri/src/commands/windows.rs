//! Commands for managing application windows.

use mt_model::contract::windows::OVERLAY_LABEL_PREFIX;
use tauri::Manager;

#[tauri::command]
pub fn reassert_all_overlays_topmost(app: tauri::AppHandle) {
    #[cfg(windows)]
    {
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        };

        for (label, window) in app.webview_windows() {
            if !label.starts_with(OVERLAY_LABEL_PREFIX) {
                continue;
            }

            let Ok(handle) = window.hwnd() else {
                continue;
            };

            // SAFETY: Tauri owns this live HWND; these flags only update its
            // z-order and prevent activation, movement, and resizing.
            if let Err(error) = unsafe {
                SetWindowPos(
                    handle,
                    Some(HWND_TOPMOST),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE,
                )
            } {
                tracing::warn!(%label, %error, "failed to reassert overlay topmost");
            }
        }
    }

    #[cfg(not(windows))]
    let _ = app;
}
