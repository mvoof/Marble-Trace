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
pub mod car_status;
pub mod environment;
pub mod lap_timing;
pub mod session;

pub use car_dynamics::CarDynamicsFrame;
pub use car_idx::CarIdxFrame;
pub use car_inputs::CarInputsFrame;
pub use car_status::CarStatusFrame;
pub use environment::EnvironmentFrame;
pub use lap_timing::LapTimingFrame;
pub use session::SessionFrame;

use pitwall::PitwallFrame;
use serde::{Deserialize, Serialize};

/// Combined telemetry frame containing ALL iRacing telemetry variables.
///
/// This struct exists only to perform a single shared memory read per tick.
/// It is private to the `iracing` module and decomposed into domain-specific
/// frames (`CarDynamicsFrame`, `CarInputsFrame`, etc.) before being emitted
/// as Tauri events.
#[derive(PitwallFrame, Serialize, Deserialize, Debug, Clone)]
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

    // === Session ===
    #[field_name = "SessionTime"]
    pub session_time: Option<f64>,
    #[field_name = "SessionTimeRemain"]
    pub session_time_remain: Option<f64>,
    #[field_name = "SessionState"]
    pub session_state: Option<i32>,
    #[field_name = "SessionFlags"]
    pub session_flags: Option<i32>,
    #[field_name = "SessionNum"]
    pub session_num: Option<i32>,

    // === Environment ===
    #[field_name = "AirTemp"]
    pub air_temp: Option<f32>,

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

// === Domain frame decomposition ===

impl From<&AllFieldsFrame> for CarDynamicsFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        Self {
            speed: f.speed,
            rpm: f.rpm,
            gear: f.gear,
            steering_wheel_angle: f.steering_wheel_angle,
            velocity_x: f.velocity_x,
            velocity_y: f.velocity_y,
            velocity_z: f.velocity_z,
            lat_accel: f.lat_accel,
            long_accel: f.long_accel,
            yaw_rate: f.yaw_rate,
            pitch: f.pitch,
            roll: f.roll,
            shift_indicator_pct: f.shift_indicator_pct,
            shift_grind_rpm: f.shift_grind_rpm,
        }
    }
}

impl From<&AllFieldsFrame> for CarInputsFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        Self {
            throttle: f.throttle,
            brake: f.brake,
            clutch: f.clutch,
        }
    }
}

impl From<&AllFieldsFrame> for CarStatusFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        Self {
            fuel_level: f.fuel_level,
            fuel_level_pct: f.fuel_level_pct,
            fuel_use_per_hour: f.fuel_use_per_hour,
            oil_temp: f.oil_temp,
            oil_press: f.oil_press,
            water_temp: f.water_temp,
            voltage: f.voltage,
            on_pit_road: f.on_pit_road,
            is_on_track: f.is_on_track,
            car_left_right: f.car_left_right,
        }
    }
}

impl From<&AllFieldsFrame> for LapTimingFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        Self {
            lap: f.lap,
            lap_dist: f.lap_dist,
            lap_dist_pct: f.lap_dist_pct,
            lap_current_lap_time: f.lap_current_lap_time,
            lap_last_lap_time: f.lap_last_lap_time,
            lap_best_lap_time: f.lap_best_lap_time,
            player_car_position: f.player_car_position,
            player_car_class_position: f.player_car_class_position,
        }
    }
}

impl From<&AllFieldsFrame> for SessionFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        Self {
            session_time: f.session_time,
            session_time_remain: f.session_time_remain,
            session_state: f.session_state,
            session_flags: f.session_flags,
            session_num: f.session_num,
        }
    }
}

impl From<&AllFieldsFrame> for CarIdxFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        Self {
            car_idx_lap_dist_pct: f.car_idx_lap_dist_pct.clone(),
            car_idx_on_pit_road: f.car_idx_on_pit_road.clone(),
            car_idx_position: f.car_idx_position.clone(),
            car_idx_class_position: f.car_idx_class_position.clone(),
            car_idx_lap: f.car_idx_lap.clone(),
            car_idx_last_lap_time: f.car_idx_last_lap_time.clone(),
            car_idx_best_lap_time: f.car_idx_best_lap_time.clone(),
            car_idx_f2_time: f.car_idx_f2_time.clone(),
            car_idx_est_time: f.car_idx_est_time.clone(),
            car_idx_track_surface: f.car_idx_track_surface.clone(),
            car_idx_tire_compound: f.car_idx_tire_compound.clone(),
            car_left_right: f.car_left_right,
        }
    }
}

impl From<&AllFieldsFrame> for EnvironmentFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        Self {
            air_temp: f.air_temp,
        }
    }
}
