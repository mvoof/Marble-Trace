//! Tauri commands — thin wrappers over the telemetry state and runtime.
//!
//! Split by what they touch rather than kept in one list: a command file that
//! mixes the settings file, the telemetry feed, the track cache and the pit
//! broadcast makes every one of them harder to find, and hides that they need
//! entirely different state.

pub mod chat;
pub mod companions;
pub mod hotkeys;
pub mod input;
pub mod install;
#[cfg(feature = "dev")]
pub mod perf;
pub mod pit;
pub mod remote;
pub mod settings;
pub mod telemetry;
pub mod track;

use tauri::ipc::Invoke;
use tauri::{generate_handler, Wry};

/// Every command the webviews can invoke. Adding one is an edit to its file
/// and to this list, nowhere else.
pub fn invoke_handler() -> impl Fn(Invoke<Wry>) -> bool + Send + Sync + 'static {
    generate_handler![
        remote::start_remote_server,
        remote::stop_remote_server,
        remote::get_remote_server_info,
        remote::get_remote_devices,
        remote::publish_remote_snapshot,
        remote::publish_remote_control,
        remote::remote_screen_url,
        telemetry::start_telemetry_stream,
        telemetry::stop_telemetry_stream,
        telemetry::get_last_session_info,
        telemetry::set_pit_warning_laps,
        telemetry::set_fuel_avg_window,
        telemetry::set_fuel_count_yellow_laps,
        telemetry::set_active_events,
        telemetry::set_remote_active_events,
        telemetry::clear_active_events,
        telemetry::clear_remote_active_events,
        telemetry::set_inspector_active,
        telemetry::get_inspector_frame,
        telemetry::get_inspector_raw_values,
        telemetry::get_raw_var_meta,
        telemetry::get_raw_session,
        telemetry::get_delivery_counters,
        telemetry::reset_delivery_counters,
        #[cfg(feature = "dev")]
        perf::get_perf_run,
        #[cfg(feature = "dev")]
        perf::submit_overlay_perf,
        telemetry::set_car_length,
        telemetry::set_overlay_update_hz,
        telemetry::get_connection_status,
        track::delete_track_shape,
        track::get_cached_track_shape,
        track::reset_pit_lane_pct,
        track::get_active_reference_lap,
        track::delete_reference_lap,
        settings::log_settings_snapshot,
        settings::backup_settings_file,
        settings::settings_file_exists,
        settings::delete_settings_file,
        install::check_install_integrity,
        pit::run_pit_action,
        pit::set_pit_strategy,
        pit::toggle_pit_auto,
        chat::start_chat_stream,
        chat::stop_chat_stream,
        chat::twitch_request_device_code,
        chat::twitch_poll_device_token,
        chat::twitch_has_client_id,
        chat::twitch_account,
        chat::twitch_sign_out,
        input::resolve_input_devices,
        input::set_input_polling_enabled,
        hotkeys::set_hotkey_bindings,
        hotkeys::set_hotkey_context,
        hotkeys::set_drag_mode,
        hotkeys::set_interact_mode,
        hotkeys::get_overlay_modes,
        companions::detect_companion_apps,
        companions::companion_app_statuses,
        companions::launch_companion_app,
        companions::close_companion_app,
        companions::close_companion_apps,
        companions::companion_app_icon
    ]
}
