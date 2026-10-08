#[cfg(feature = "dev")]
mod bindings;
mod capabilities;
mod chat;
mod commands;
mod companions;
mod computations;
mod hotkeys;
mod input;
mod logging;
mod model;
mod process_priority;
mod remote;
mod sources;
mod telemetry;
mod utils;

use chat::commands::{
    start_chat_stream, stop_chat_stream, twitch_account, twitch_has_client_id,
    twitch_poll_device_token, twitch_request_device_code, twitch_sign_out,
};
use chat::state::{ChatServiceState, ChatState};
#[cfg(feature = "dev")]
use commands::perf::{get_perf_run, submit_overlay_perf};
use commands::{
    backup_settings_file, check_install_integrity, clear_active_events, clear_remote_active_events,
    close_companion_app, close_companion_apps, companion_app_icon, companion_app_statuses,
    delete_reference_lap, delete_settings_file, delete_track_shape, detect_companion_apps,
    get_active_reference_lap, get_cached_track_shape, get_connection_status, get_delivery_counters,
    get_inspector_frame, get_last_session_info, launch_companion_app, log_settings_snapshot,
    reset_delivery_counters, reset_pit_lane_pct, run_pit_action, set_active_events, set_car_length,
    set_fuel_avg_window, set_fuel_count_yellow_laps, set_inspector_active, set_pit_strategy,
    set_pit_warning_laps, set_remote_active_events, settings_file_exists, start_telemetry_stream,
    stop_telemetry_stream, toggle_pit_auto,
};
use companions::CompanionsState;
use hotkeys::commands::{
    get_overlay_modes, set_drag_mode, set_hotkey_bindings, set_hotkey_context, set_interact_mode,
};
use hotkeys::{on_device_edge, HotkeyState};
use input::commands::{resolve_input_devices, set_input_polling_enabled, InputState};
use input::InputRuntime;
use remote::commands::{
    get_remote_devices, get_remote_server_info, publish_remote_control, publish_remote_snapshot,
    remote_screen_url, start_remote_server, stop_remote_server, RemoteState,
};
use telemetry::control::TelemetryCommand;
#[cfg(feature = "dev")]
use telemetry::perf_run::{spawn_if_requested, PerfRunConfig, PerfRunState};
use telemetry::state::TelemetryState;
use utils::lock_or_recover;

use std::sync::Arc;
use tauri::{generate_context, generate_handler, Builder, Listener, Manager, WindowEvent};
use tauri_plugin_aptabase::EventTracker;
use tauri_plugin_store::StoreExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(feature = "dev")]
    bindings::export();

    let aptabase_key = option_env!("APTABASE_KEY").unwrap_or("");

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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_aptabase::Builder::new(aptabase_key).build());

    #[cfg(feature = "dev")]
    let builder = builder.plugin(tauri_plugin_mcp_bridge::init());

    builder
        .setup(|app| {
            let log_file_guard = logging::init(app);
            app.manage(log_file_guard);
            logging::log_startup_info(app);

            process_priority::lower_to_below_normal();

            // Registered before any server can start: the hub simply drops
            // everything while no browser is connected.
            let remote_state = RemoteState::default();
            remote::mirror::attach(app.handle(), std::sync::Arc::clone(&remote_state.hub));
            app.manage(remote_state);

            #[cfg(feature = "dev")]
            {
                app.manage(PerfRunState {
                    config: PerfRunConfig::from_env(),
                    ..Default::default()
                });
                spawn_if_requested(app.handle());
            }

            {
                let handle = app.handle().clone();
                app.listen("track-map:force-start", move |_| {
                    let telemetry = handle.state::<TelemetryState>();
                    telemetry.service.send(TelemetryCommand::ForceTrackStart);
                });
            }
            {
                let handle = app.handle().clone();
                app.listen("track-map:clear", move |_| {
                    let telemetry = handle.state::<TelemetryState>();
                    telemetry.service.send(TelemetryCommand::ClearTrackShape);
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

            let start_minimized = app
                .store("settings.json")
                .ok()
                .and_then(|store| store.get("settings"))
                .and_then(|settings| settings.get("app")?.get("startMinimized")?.as_bool())
                .unwrap_or(false);

            if start_minimized {
                if let Some(main_window) = app.get_webview_window("main") {
                    let _ = main_window.minimize();
                }
            }

            // Started here rather than in `manage` above: DirectInput needs the
            // main window's HWND for background cooperative level, and that
            // only exists once the windows have been created.
            app.manage(InputState {
                runtime: Some(InputRuntime::start(app.handle().clone(), on_device_edge)),
            });

            Ok(())
        })
        .invoke_handler(generate_handler![
            start_remote_server,
            stop_remote_server,
            get_remote_server_info,
            get_remote_devices,
            publish_remote_snapshot,
            publish_remote_control,
            remote_screen_url,
            start_telemetry_stream,
            stop_telemetry_stream,
            get_last_session_info,
            set_pit_warning_laps,
            set_fuel_avg_window,
            set_fuel_count_yellow_laps,
            set_active_events,
            set_remote_active_events,
            clear_active_events,
            clear_remote_active_events,
            set_inspector_active,
            get_inspector_frame,
            get_delivery_counters,
            reset_delivery_counters,
            #[cfg(feature = "dev")]
            get_perf_run,
            #[cfg(feature = "dev")]
            submit_overlay_perf,
            set_car_length,
            get_connection_status,
            delete_track_shape,
            get_cached_track_shape,
            reset_pit_lane_pct,
            get_active_reference_lap,
            delete_reference_lap,
            log_settings_snapshot,
            backup_settings_file,
            settings_file_exists,
            delete_settings_file,
            check_install_integrity,
            run_pit_action,
            set_pit_strategy,
            toggle_pit_auto,
            start_chat_stream,
            stop_chat_stream,
            twitch_request_device_code,
            twitch_poll_device_token,
            twitch_has_client_id,
            twitch_account,
            twitch_sign_out,
            resolve_input_devices,
            set_input_polling_enabled,
            set_hotkey_bindings,
            set_hotkey_context,
            set_drag_mode,
            set_interact_mode,
            get_overlay_modes,
            detect_companion_apps,
            companion_app_statuses,
            launch_companion_app,
            close_companion_app,
            close_companion_apps,
            companion_app_icon
        ])
        .manage(CompanionsState::default())
        .manage(ChatState {
            service: Arc::new(ChatServiceState::new()),
        })
        .manage(TelemetryState::default())
        .manage(HotkeyState::default())
        .on_window_event(|window, event| match event {
            WindowEvent::Destroyed => {
                tracing::info!(window = window.label(), "window destroyed");

                // A window that is gone must not keep a demand-gated field
                // switched on for everyone else.
                let app_handle = window.app_handle();
                let service = &app_handle.state::<TelemetryState>().service;

                service.masks.drop_label(window.label());
                lock_or_recover(&service.delivery).drop_label(window.label());

                // Overlay windows are created per monitor at runtime, labelled
                // "overlay-<monitor>", so they are torn down by prefix.
                if window.label() == "main" {
                    for (label, overlay) in window.app_handle().webview_windows() {
                        if label.starts_with("overlay-") {
                            let _ = overlay.destroy();
                        }
                    }

                    // Only the instances this app started, and only the ones
                    // still marked to close with it — see `companions::close`.
                    companions::close_all_owned(&window.app_handle().state::<CompanionsState>());
                }
            }
            WindowEvent::Resized(size) => {
                tracing::debug!(
                    window = window.label(),
                    width = size.width,
                    height = size.height,
                    "window resized"
                );
            }
            WindowEvent::Moved(position) => {
                tracing::debug!(
                    window = window.label(),
                    x = position.x,
                    y = position.y,
                    "window moved"
                );
            }
            WindowEvent::ScaleFactorChanged { scale_factor, .. } => {
                tracing::info!(window = window.label(), scale_factor, "window DPI changed");
            }
            _ => {}
        })
        .run(generate_context!())
        .expect("error while running tauri application");
}
