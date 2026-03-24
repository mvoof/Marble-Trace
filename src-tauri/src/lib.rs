mod iracing;
mod telemetry_frame;

use iracing::{start_telemetry_stream, stop_telemetry_stream, TelemetryState};
use specta_typescript::Typescript;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{generate_context, Builder as TauriBuilder, Manager, WindowEvent, Wry};
use tauri_specta::{collect_commands, collect_events, Builder as SpectaBuilder};
use telemetry_frame::{TelemetryDebugEvent, TelemetryDisconnectedEvent, TelemetryFrameEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = SpectaBuilder::<Wry>::new()
        .commands(collect_commands![
            start_telemetry_stream,
            stop_telemetry_stream
        ])
        .events(collect_events![
            TelemetryFrameEvent,
            TelemetryDebugEvent,
            TelemetryDisconnectedEvent
        ]);

    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export typescript bindings");

    let mut builder_app = TauriBuilder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build());

    #[cfg(debug_assertions)]
    {
        builder_app = builder_app.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder_app
        .invoke_handler(builder.invoke_handler())
        .manage(TelemetryState {
            running: Arc::new(AtomicBool::new(false)),
        })
        .setup(move |app| {
            builder.mount_events(app);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    let app = window.app_handle();
                    for (label, win) in app.webview_windows() {
                        if label != "main" {
                            let _ = win.destroy();
                        }
                    }
                }
            }
        })
        .run(generate_context!())
        .expect("error while running tauri application");
}
