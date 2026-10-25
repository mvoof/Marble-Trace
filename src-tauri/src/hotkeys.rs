//! The hotkey dispatcher's link to the app: the OS's global shortcuts through
//! `tauri-plugin-global-shortcut`, and the overlay windows open right now.

use std::sync::Arc;

use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use mt_hotkeys::runtime::{HotkeyHost, KeyEdge, KeyRegistrar};
use mt_model::contract::windows::OVERLAY_LABEL_PREFIX;
use mt_remote::hub::RemoteHub;
use mt_telemetry::state::TelemetryState;

use crate::sink::TauriSink;

struct GlobalShortcutKeys(AppHandle);

impl KeyRegistrar for GlobalShortcutKeys {
    fn register(&self, accelerator: &str, on_edge: KeyEdge) -> Result<(), String> {
        self.0
            .global_shortcut()
            .on_shortcut(accelerator, move |_, _, event| {
                on_edge(event.state == ShortcutState::Pressed);
            })
            .map_err(|error| error.to_string())
    }

    fn unregister(&self, accelerator: &str) -> Result<(), String> {
        self.0
            .global_shortcut()
            .unregister(accelerator)
            .map_err(|error| error.to_string())
    }
}

pub fn hotkey_host(app: &AppHandle, remote: Arc<RemoteHub>) -> HotkeyHost {
    let windows_app = app.clone();

    HotkeyHost {
        sink: Arc::new(TauriSink(app.clone())),
        telemetry: Arc::clone(&app.state::<TelemetryState>().service),
        remote,
        overlay_labels: Box::new(move || {
            windows_app
                .webview_windows()
                .into_keys()
                .filter(|label| label.starts_with(OVERLAY_LABEL_PREFIX))
                .collect()
        }),
        keys: Box::new(GlobalShortcutKeys(app.clone())),
    }
}
