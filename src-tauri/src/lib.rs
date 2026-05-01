mod computations;
mod iracing;

use computations::{
    fuel::{FuelComputedFrame, FuelState},
    lap_delta::{LapDeltaFrame, LapDeltaState},
    pit_stops::PitStopsFrame,
    proximity::{LateralSide, NearbyCar, ProximityFrame, RadarDistances},
    standings::{DriverEntriesFrame, DriverEntry, StandingsState},
};
use iracing::{
    get_last_session_info, set_pit_warning_laps, start_telemetry_stream, stop_telemetry_stream,
    CarDynamicsFrame, CarIdxFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, EnvironmentFrame,
    LapTimingFrame, SessionFrame, TelemetryState, WeatherForecastEntry,
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
        .register::<CarIdxFrame>()
        .register::<CarInputsFrame>()
        .register::<CarStatusFrame>()
        .register::<ChassisFrame>()
        .register::<LapTimingFrame>()
        .register::<SessionFrame>()
        .register::<EnvironmentFrame>()
        .register::<SessionInfo>()
        .register::<ProximityFrame>()
        .register::<NearbyCar>()
        .register::<RadarDistances>()
        .register::<LateralSide>()
        .register::<FuelComputedFrame>()
        .register::<DriverEntriesFrame>()
        .register::<DriverEntry>()
        .register::<PitStopsFrame>()
        .register::<LapDeltaFrame>()
        .register::<WeatherForecastEntry>();

    Typescript::default()
        .export_to("../src/types/bindings.ts", &types)
        .unwrap();

    let mut builder = Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build());

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_decorations(false);
                let _ = window.set_shadow(true);
            }
            Ok(())
        })
        .invoke_handler(generate_handler![
            start_telemetry_stream,
            stop_telemetry_stream,
            get_last_session_info,
            set_pit_warning_laps
        ])
        .manage(TelemetryState {
            running: Arc::new(AtomicBool::new(false)),
            last_session_info: Arc::new(Mutex::new(None)),
            start_positions: Arc::new(Mutex::new(std::collections::HashMap::new())),
            pit_stop_count: Arc::new(std::sync::atomic::AtomicU32::new(0)),
            was_on_pit_road: Arc::new(AtomicBool::new(false)),
            pit_tracked_session_num: Arc::new(std::sync::atomic::AtomicI32::new(-1)),
            lap_delta_state: Arc::new(Mutex::new(LapDeltaState::default())),
            standings_state: Arc::new(Mutex::new(StandingsState::default())),
            pit_warning_laps: Arc::new(std::sync::atomic::AtomicU32::new(3.0f32.to_bits())),
            track_length_m: Arc::new(Mutex::new(None)),
            fuel_state: Arc::new(Mutex::new(FuelState::default())),
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    if let Some(overlay) = window.app_handle().get_webview_window("overlay") {
                        let _ = overlay.destroy();
                    }
                }
            }
        })
        .run(generate_context!())
        .expect("error while running tauri application");
}
