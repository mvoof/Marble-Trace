mod iracing;

use iracing::{
    get_last_session_info, start_telemetry_stream, stop_telemetry_stream,
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, EnvironmentFrame,
    LapTimingFrame, SessionFrame, TelemetryState,
};
use pitwall::SessionInfo;
use specta::TypeCollection;
use specta_typescript::Typescript;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use tauri::{generate_context, generate_handler, Builder, Manager, WindowEvent};
use tracing_subscriber::EnvFilter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("marble_trace_lib=info")),
        )
        .init();

    let mut types = TypeCollection::default();
    types
        .register::<CarDynamicsFrame>()
        .register::<CarInputsFrame>()
        .register::<CarStatusFrame>()
        .register::<LapTimingFrame>()
        .register::<SessionFrame>()
        .register::<EnvironmentFrame>()
        .register::<SessionInfo>();

    Typescript::default()
        .export_to("../src/types/bindings.ts", &types)
        .unwrap();

    let mut builder = Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build());

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .invoke_handler(generate_handler![
            start_telemetry_stream,
            stop_telemetry_stream,
            get_last_session_info
        ])
        .manage(TelemetryState {
            running: Arc::new(AtomicBool::new(false)),
            last_session_info: Arc::new(Mutex::new(None)),
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
