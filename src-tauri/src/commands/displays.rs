//! What the layout editor's monitor map needs that the webview's own monitor
//! list does not carry: the model name of each monitor.

use crate::display_names::{display_names, DisplayName};

/// Read on every arrangement change, off the async runtime: the display
/// configuration API takes the display lock.
#[tauri::command]
pub async fn list_display_names() -> Result<Vec<DisplayName>, String> {
    tauri::async_runtime::spawn_blocking(display_names)
        .await
        .map_err(|error| format!("display name task failed: {error}"))
}
