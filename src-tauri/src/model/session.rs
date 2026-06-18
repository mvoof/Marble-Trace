/// Session telemetry — real-time session state from the telemetry stream.
///
/// Contains session time, remaining time, session state flags,
/// and current session index. Changes infrequently compared to car data.
///
/// For static session YAML data (driver info, weekend info), see
/// `SessionSnapshot` emitted via `sim://session`.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
use serde::{Deserialize, Serialize};

use crate::model::enums::SessionState;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
pub struct SessionFrame {
    /// Seconds since the session started
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessiontime/
    pub session_time: Option<f64>,

    /// Seconds remaining in the session
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessiontimeremain/
    pub session_time_remain: Option<f64>,

    /// Session state enum value (invalid, warmup, racing, etc.)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessionstate/
    pub session_state: Option<SessionState>,

    /// Session flags bit field (green, yellow, red, etc.)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessionflags/
    pub session_flags: Option<u32>,

    /// Index of the current session (practice=0, qualifying=1, race=2, etc.)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessionnum/
    pub session_num: Option<i32>,

    /// In-simulator time of day in seconds since midnight
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessiontimeofday/
    pub session_time_of_day: Option<f32>,

    /// Laps remaining in the session (leader-based, preferred over SessionLapsRemain)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/sessionlapsremainex/
    pub session_laps_remain_ex: Option<i32>,

    /// Index of the player's car in CarIdx arrays
    /// @see https://sajax.github.io/irsdkdocs/telemetry/playercaridx/
    pub player_car_idx: Option<i32>,

    /// Per-car session flags for the player's car (black flag, DQ, meatball, etc.)
    /// Extracted from CarIdxSessionFlags[player_car_idx]
    /// @see https://sajax.github.io/irsdkdocs/telemetry/caridxsessionflags/
    pub player_car_flags: Option<u32>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionSnapshot {
    pub track_id: i32,
    /// Directory-style track name (e.g. "okayama full").
    pub track_name: String,
    pub track_display_name: String,
    pub track_config_name: String,
    /// Track length in meters, parsed from iRacing's "3.70 km" / "2.30 mi".
    pub track_length_m: f32,
    /// Raw iRacing display strings with units (e.g. "56.33 kph", "25.55 C").
    pub track_pit_speed_limit: String,
    pub track_weather_type: String,
    pub track_air_temp: String,
    pub track_surface_temp: String,
    pub track_wind_vel: String,
    pub track_wind_dir: String,
    pub track_relative_humidity: String,
    /// Simulated session date from WeekendOptions (e.g. "2026-06-11").
    pub weekend_date: String,
    pub current_session_num: i32,
    pub sessions: Vec<SessionEntry>,
    pub player_car_idx: i32,
    /// Player car constants from DriverInfo (None when absent in YAML).
    pub driver_car_fuel_max_ltr: Option<f32>,
    pub driver_car_red_line: Option<f32>,
    pub driver_car_sl_shift_rpm: Option<f32>,
    pub driver_car_sl_blink_rpm: Option<f32>,
    pub cars: Vec<CarEntry>,
    pub driver_tires: Vec<TireCompoundEntry>,
    pub sectors: Vec<SectorEntry>,
    pub qualify_results: Vec<QualifyResultEntry>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
pub enum SessionType {
    Practice,
    Qualify,
    Race,
    #[default]
    Unknown,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionEntry {
    pub session_type: SessionType,
    /// Original label from the sim ("Lone Qualify", "Race", etc.) — use for display.
    pub session_type_label: String,
    /// "unlimited" or a lap count as string (iRacing emits both forms).
    pub session_laps: String,
    pub results_positions: Vec<ResultPosition>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResultPosition {
    pub car_idx: i32,
    /// 1-indexed overall position.
    pub position: i32,
    /// 0-indexed class position (iRacing convention).
    pub class_position: Option<i32>,
    pub lap: Option<i32>,
    pub time: Option<f32>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CarEntry {
    pub car_idx: i32,
    pub user_name: String,
    pub car_number: String,
    pub car_class_id: i32,
    /// Raw iRacing color string (e.g. "0xffda59").
    pub car_class_color: String,
    pub car_screen_name: String,
    pub car_screen_name_short: String,
    pub i_rating: i32,
    pub lic_string: String,
    pub lic_color: String,
    pub incident_count: i32,
    pub is_pace_car: bool,
    pub is_spectator: bool,
    pub car_class_est_lap_time: f32,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TireCompoundEntry {
    pub tire_index: i32,
    pub tire_compound_type: String,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SectorEntry {
    pub sector_num: i32,
    pub sector_start_pct: f64,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct QualifyResultEntry {
    pub car_idx: i32,
    /// 0-indexed (iRacing convention; frontend adds 1 for display).
    pub position: i32,
    pub class_position: Option<i32>,
}
