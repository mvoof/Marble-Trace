//! Tauri commands — thin wrappers over the telemetry state and runtime.
//!
//! Split by what they touch rather than kept in one list: a command file that
//! mixes the settings file, the telemetry feed, the track cache and the pit
//! broadcast makes every one of them harder to find, and hides that they need
//! entirely different state.

pub mod pit;
pub mod settings;
pub mod telemetry;
pub mod track;

pub use pit::send_pit_order;
pub use settings::{
    backup_settings_file, delete_settings_file, log_settings_snapshot, settings_file_exists,
};
pub use telemetry::{
    get_connection_status, get_inspector_frame, get_last_session_info, set_active_events,
    set_car_length, set_fuel_avg_window, set_inspector_active, set_pit_warning_laps,
    start_telemetry_stream, stop_telemetry_stream,
};
pub use track::{
    delete_reference_lap, delete_track_shape, get_cached_track_shape, get_reference_lap,
    reset_pit_lane_pct,
};
