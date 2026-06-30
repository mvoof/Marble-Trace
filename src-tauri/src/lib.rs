mod capabilities;
mod commands;
mod computations;
mod model;
mod sources;
mod telemetry;
mod utils;

#[cfg(feature = "dev")]
use computations::{
    fuel::FuelComputedFrame,
    lap_delta::LapDeltaFrame,
    pit_stops::PitStopsFrame,
    proximity::{LateralSide, NearbyCar, ProximityFrame, RadarDistances},
    standings::{DriverEntriesFrame, DriverEntry},
};
#[cfg(feature = "dev")]
use model::track_shape::{TrackPoint, TrackRecordingFrame, TrackShapePayload};

use commands::{
    delete_track_shape, get_connection_status, get_last_session_info, reset_pit_lane_pct,
    set_active_events, set_car_length, set_pit_warning_laps, start_telemetry_stream,
    stop_telemetry_stream,
};
use computations::ProcessorRegistry;
use telemetry::state::TelemetryState;

#[cfg(feature = "dev")]
use model::capabilities::CapabilitiesPayload;
#[cfg(feature = "dev")]
use model::cars::CarIdxFrame;
#[cfg(feature = "dev")]
use model::enums::{SimStatus, SimType};
#[cfg(feature = "dev")]
use model::environment::{EnvironmentFrame, WeatherForecastEntry};
#[cfg(feature = "dev")]
use model::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame,
};
#[cfg(feature = "dev")]
use model::session::SessionFrame;

#[cfg(feature = "dev")]
use model::session::SessionSnapshot;
#[cfg(feature = "dev")]
use specta::TypeCollection;
#[cfg(feature = "dev")]
use specta_typescript::Typescript;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU32};
use std::sync::{Arc, Mutex};
use tauri::{generate_context, generate_handler, Builder, Listener, Manager, WindowEvent};
use tauri_plugin_aptabase::EventTracker;
use tracing_subscriber::EnvFilter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("marble_trace_lib=info")),
        )
        .init();

    #[cfg(feature = "dev")]
    {
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
            .register::<NearbyCar>()
            .register::<RadarDistances>()
            .register::<LateralSide>()
            .register::<SessionSnapshot>()
            .register::<ProximityFrame>()
            .register::<FuelComputedFrame>()
            .register::<DriverEntriesFrame>()
            .register::<DriverEntry>()
            .register::<PitStopsFrame>()
            .register::<LapDeltaFrame>()
            .register::<telemetry::emitter::TelemetryBundle>()
            .register::<WeatherForecastEntry>()
            .register::<CapabilitiesPayload>()
            .register::<SimType>()
            .register::<SimStatus>();

        types
            .register::<TrackPoint>()
            .register::<TrackShapePayload>()
            .register::<TrackRecordingFrame>();

        Typescript::default()
            .export_to("../src/types/bindings.ts", &types)
            .unwrap();
    }

    let aptabase_key = option_env!("APTABASE_KEY").unwrap_or("");
    let force_track_start = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let reset_pit_pcts = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));

    let force_track_start_listener = std::sync::Arc::clone(&force_track_start);
    let force_track_start_registry = std::sync::Arc::clone(&force_track_start);
    let reset_pit_pcts_registry = std::sync::Arc::clone(&reset_pit_pcts);
    let reset_pit_pcts_state = std::sync::Arc::clone(&reset_pit_pcts);

    let builder = Builder::default()
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_denylist(&["overlay"])
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_aptabase::Builder::new(aptabase_key).build());

    #[cfg(feature = "dev")]
    let builder = builder.plugin(tauri_plugin_mcp_bridge::init());

    builder
        .setup(|app| {
            {
                let flag = force_track_start_listener;
                app.listen("track-map:force-start", move |_| {
                    flag.store(true, std::sync::atomic::Ordering::Relaxed);
                });
            }

            let monitor = app.primary_monitor().ok().flatten();
            let locale = sys_locale::get_locale().unwrap_or_else(|| "unknown".to_string());
            let props = serde_json::json!({
                "screen_width": monitor.as_ref().map(|monitor| monitor.size().width),
                "screen_height": monitor.as_ref().map(|monitor| monitor.size().height),
                "scale_factor": monitor.as_ref().map(|monitor| monitor.scale_factor()),
                "dpi": monitor.as_ref().map(|monitor| (96.0 * monitor.scale_factor()) as u32),
                "locale": locale,
            });
            let _ = app.track_event("app_started", Some(props));
            Ok(())
        })
        .invoke_handler(generate_handler![
            start_telemetry_stream,
            stop_telemetry_stream,
            get_last_session_info,
            set_pit_warning_laps,
            set_active_events,
            set_car_length,
            get_connection_status,
            delete_track_shape,
            reset_pit_lane_pct
        ])
        .manage(TelemetryState {
            service: Arc::new(telemetry::state::TelemetryServiceState {
                running: AtomicBool::new(false),
                is_connected: AtomicBool::new(false),
                last_session_info: Mutex::new(None),
                start_positions: Mutex::new(std::collections::HashMap::new()),
                start_positions_session_num: AtomicI32::new(-1),
                track_length_m: Mutex::new(None),
                pit_in_pct: Mutex::new(None),
                pit_exit_pct: Mutex::new(None),
                active_events: AtomicU32::new(0xFFFFFFFF),
                car_length_m: Mutex::new(4.4),
            }),
            registry: Arc::new(Mutex::new(ProcessorRegistry::new(
                force_track_start_registry,
                reset_pit_pcts_registry,
            ))),
            pit_warning_laps: Arc::new(AtomicU32::new(
                crate::computations::fuel::DEFAULT_PIT_WARNING_LAPS.to_bits(),
            )),
            reset_pit_pcts: reset_pit_pcts_state,
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
