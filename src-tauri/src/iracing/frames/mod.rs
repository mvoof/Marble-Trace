/// iRacing telemetry frame types — domain-separated telemetry data.
///
/// All telemetry variables are read from iRacing's shared memory via a single
/// `AllFieldsFrame` using the `pitwall` crate's `PitwallFrame` derive macro.
/// The combined frame is then decomposed into domain-specific structs for
/// efficient, organized event emission to the frontend.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
pub mod car_dynamics;
pub mod car_idx;
pub mod car_inputs;
pub mod car_positions;
pub mod car_status;
pub mod chassis;
pub mod environment;
pub mod lap_timing;
pub mod session;

pub use car_dynamics::CarDynamicsFrame;
pub use car_idx::CarIdxFrame;
pub use car_inputs::CarInputsFrame;
pub use car_positions::CarPositionsFrame;
pub use car_status::CarStatusFrame;
pub use chassis::ChassisFrame;
pub use environment::EnvironmentFrame;
pub use lap_timing::LapTimingFrame;
pub use session::SessionFrame;

use pitwall::{BitField, PitwallFrame};
use serde::{Deserialize, Serialize};

fn bitfield_to_u32(bits: BitField) -> u32 {
    bits.0
}

/// Combined telemetry frame containing ALL iRacing telemetry variables.
///
/// This struct exists only to perform a single shared memory read per tick.
/// It is private to the `iracing` module and decomposed into domain-specific
/// frames (`CarDynamicsFrame`, `CarInputsFrame`, etc.) before being emitted
/// as Tauri events.
#[derive(PitwallFrame, Serialize, Deserialize, Debug, Clone, Default)]
pub(crate) struct AllFieldsFrame {
    // === Car Dynamics ===
    #[field_name = "Speed"]
    pub speed: f32,
    #[field_name = "RPM"]
    pub rpm: f32,
    #[field_name = "Gear"]
    pub gear: i32,
    #[field_name = "SteeringWheelAngle"]
    pub steering_wheel_angle: f32,
    #[field_name = "VelocityX"]
    pub velocity_x: Option<f32>,
    #[field_name = "VelocityY"]
    pub velocity_y: Option<f32>,
    #[field_name = "VelocityZ"]
    pub velocity_z: Option<f32>,
    #[field_name = "LatAccel"]
    pub lat_accel: Option<f32>,
    #[field_name = "LongAccel"]
    pub long_accel: Option<f32>,
    #[field_name = "YawRate"]
    pub yaw_rate: Option<f32>,
    #[field_name = "Pitch"]
    pub pitch: Option<f32>,
    #[field_name = "Roll"]
    pub roll: Option<f32>,
    #[field_name = "Yaw"]
    pub yaw: Option<f32>,
    #[field_name = "ShiftIndicatorPct"]
    pub shift_indicator_pct: Option<f32>,
    #[field_name = "ShiftGrindRPM"]
    pub shift_grind_rpm: Option<f32>,

    // === Car Inputs ===
    #[field_name = "Throttle"]
    pub throttle: f32,
    #[field_name = "Brake"]
    pub brake: f32,
    #[field_name = "Clutch"]
    pub clutch: Option<f32>,

    // === Car Status ===
    #[field_name = "FuelLevel"]
    pub fuel_level: f32,
    #[field_name = "FuelLevelPct"]
    pub fuel_level_pct: Option<f32>,
    #[field_name = "FuelUsePerHour"]
    pub fuel_use_per_hour: Option<f32>,
    #[field_name = "OilTemp"]
    pub oil_temp: f32,
    #[field_name = "OilPress"]
    pub oil_press: Option<f32>,
    #[field_name = "WaterTemp"]
    pub water_temp: f32,
    #[field_name = "Voltage"]
    pub voltage: Option<f32>,
    #[field_name = "OnPitRoad"]
    pub on_pit_road: Option<bool>,
    #[field_name = "IsOnTrack"]
    pub is_on_track: Option<bool>,
    #[field_name = "CarLeftRight"]
    pub car_left_right: Option<i32>,
    #[bitfield_map(name = "EngineWarnings", decoder = "bitfield_to_u32")]
    pub engine_warnings: Option<u32>,

    // === Lap Timing ===
    #[field_name = "Lap"]
    pub lap: Option<i32>,
    #[field_name = "LapDist"]
    pub lap_dist: Option<f32>,
    #[field_name = "LapDistPct"]
    pub lap_dist_pct: Option<f32>,
    #[field_name = "LapCurrentLapTime"]
    pub lap_current_lap_time: f32,
    #[field_name = "LapLastLapTime"]
    pub lap_last_lap_time: Option<f32>,
    #[field_name = "LapBestLapTime"]
    pub lap_best_lap_time: Option<f32>,
    #[field_name = "PlayerCarPosition"]
    pub player_car_position: Option<i32>,
    #[field_name = "PlayerCarClassPosition"]
    pub player_car_class_position: Option<i32>,
    #[field_name = "LapDeltaToSessionBest_Live"]
    pub lap_delta_to_session_best_live: Option<f32>,
    #[field_name = "LapDeltaToSessionOptimal_Live"]
    pub lap_delta_to_session_optimal_live: Option<f32>,

    // === Session ===
    #[field_name = "SessionTime"]
    pub session_time: Option<f64>,
    #[field_name = "SessionTimeRemain"]
    pub session_time_remain: Option<f64>,
    #[field_name = "SessionState"]
    pub session_state: Option<i32>,
    #[bitfield_map(name = "SessionFlags", decoder = "bitfield_to_u32")]
    pub session_flags: Option<u32>,
    #[field_name = "SessionNum"]
    pub session_num: Option<i32>,
    #[field_name = "SessionTimeOfDay"]
    pub session_time_of_day: Option<f32>,
    #[field_name = "PlayerCarIdx"]
    pub player_car_idx: Option<i32>,
    #[field_name = "CarIdxSessionFlags"]
    pub car_idx_session_flags: Vec<BitField>,

    // === Environment ===
    #[field_name = "AirTemp"]
    pub air_temp: Option<f32>,
    #[field_name = "TrackTemp"]
    pub track_temp: Option<f32>,
    #[field_name = "WindVel"]
    pub wind_vel: Option<f32>,
    #[field_name = "WindDir"]
    pub wind_dir: Option<f32>,
    #[field_name = "RelativeHumidity"]
    pub relative_humidity: Option<f32>,
    #[field_name = "Skies"]
    pub skies: Option<i32>,
    #[field_name = "Precipitation"]
    pub precipitation: Option<f32>,
    #[field_name = "TrackWetness"]
    pub track_wetness: Option<i32>,
    #[field_name = "WeatherDeclaredWet"]
    pub weather_declared_wet: Option<bool>,
    #[field_name = "WeatherType"]
    pub weather_type: Option<i32>,
    #[field_name = "WeatherVersion"]
    pub weather_version: Option<i32>,

    // === Chassis — Ride Height (meters) ===
    #[field_name = "LFrideHeight"]
    pub lf_ride_height: Option<f32>,
    #[field_name = "RFrideHeight"]
    pub rf_ride_height: Option<f32>,
    #[field_name = "LRrideHeight"]
    pub lr_ride_height: Option<f32>,
    #[field_name = "RRrideHeight"]
    pub rr_ride_height: Option<f32>,

    // === Chassis — Shock Deflection (meters) ===
    #[field_name = "LFshockDefl"]
    pub lf_shock_defl: Option<f32>,
    #[field_name = "RFshockDefl"]
    pub rf_shock_defl: Option<f32>,
    #[field_name = "LRshockDefl"]
    pub lr_shock_defl: Option<f32>,
    #[field_name = "RRshockDefl"]
    pub rr_shock_defl: Option<f32>,

    // === Chassis — Tire Temperatures °C (inner/middle/outer) ===
    #[field_name = "LFtempCL"]
    pub lf_temp_cl: Option<f32>,
    #[field_name = "LFtempCM"]
    pub lf_temp_cm: Option<f32>,
    #[field_name = "LFtempCR"]
    pub lf_temp_cr: Option<f32>,
    #[field_name = "RFtempCL"]
    pub rf_temp_cl: Option<f32>,
    #[field_name = "RFtempCM"]
    pub rf_temp_cm: Option<f32>,
    #[field_name = "RFtempCR"]
    pub rf_temp_cr: Option<f32>,
    #[field_name = "LRtempCL"]
    pub lr_temp_cl: Option<f32>,
    #[field_name = "LRtempCM"]
    pub lr_temp_cm: Option<f32>,
    #[field_name = "LRtempCR"]
    pub lr_temp_cr: Option<f32>,
    #[field_name = "RRtempCL"]
    pub rr_temp_cl: Option<f32>,
    #[field_name = "RRtempCM"]
    pub rr_temp_cm: Option<f32>,
    #[field_name = "RRtempCR"]
    pub rr_temp_cr: Option<f32>,

    // === Chassis — Tire Cold Pressure (kPa) ===
    #[field_name = "LFcoldPressure"]
    pub lf_pressure: Option<f32>,
    #[field_name = "RFcoldPressure"]
    pub rf_pressure: Option<f32>,
    #[field_name = "LRcoldPressure"]
    pub lr_pressure: Option<f32>,
    #[field_name = "RRcoldPressure"]
    pub rr_pressure: Option<f32>,

    // === Chassis — Tire Wear (0.0–1.0, inner/middle/outer) ===
    #[field_name = "LFwearL"]
    pub lf_wear_l: Option<f32>,
    #[field_name = "LFwearM"]
    pub lf_wear_m: Option<f32>,
    #[field_name = "LFwearR"]
    pub lf_wear_r: Option<f32>,
    #[field_name = "RFwearL"]
    pub rf_wear_l: Option<f32>,
    #[field_name = "RFwearM"]
    pub rf_wear_m: Option<f32>,
    #[field_name = "RFwearR"]
    pub rf_wear_r: Option<f32>,
    #[field_name = "LRwearL"]
    pub lr_wear_l: Option<f32>,
    #[field_name = "LRwearM"]
    pub lr_wear_m: Option<f32>,
    #[field_name = "LRwearR"]
    pub lr_wear_r: Option<f32>,
    #[field_name = "RRwearL"]
    pub rr_wear_l: Option<f32>,
    #[field_name = "RRwearM"]
    pub rr_wear_m: Option<f32>,
    #[field_name = "RRwearR"]
    pub rr_wear_r: Option<f32>,

    // === Chassis — Brake Disc Temperature (°C) ===
    #[field_name = "LFbrakeTemp"]
    pub lf_brake_temp: Option<f32>,
    #[field_name = "RFbrakeTemp"]
    pub rf_brake_temp: Option<f32>,
    #[field_name = "LRbrakeTemp"]
    pub lr_brake_temp: Option<f32>,
    #[field_name = "RRbrakeTemp"]
    pub rr_brake_temp: Option<f32>,

    // === Car Index (per-car arrays) ===
    #[field_name = "CarIdxLapDistPct"]
    pub car_idx_lap_dist_pct: Vec<f32>,
    #[field_name = "CarIdxOnPitRoad"]
    pub car_idx_on_pit_road: Vec<bool>,
    #[field_name = "CarIdxPosition"]
    pub car_idx_position: Vec<i32>,
    #[field_name = "CarIdxClassPosition"]
    pub car_idx_class_position: Vec<i32>,
    #[field_name = "CarIdxLap"]
    pub car_idx_lap: Vec<i32>,
    #[field_name = "CarIdxLastLapTime"]
    pub car_idx_last_lap_time: Vec<f32>,
    #[field_name = "CarIdxBestLapTime"]
    pub car_idx_best_lap_time: Vec<f32>,
    #[field_name = "CarIdxF2Time"]
    pub car_idx_f2_time: Vec<f32>,
    #[field_name = "CarIdxEstTime"]
    pub car_idx_est_time: Vec<f32>,
    #[field_name = "CarIdxTrackSurface"]
    pub car_idx_track_surface: Vec<i32>,
    #[field_name = "CarIdxTireCompound"]
    pub car_idx_tire_compound: Vec<i32>,
}
