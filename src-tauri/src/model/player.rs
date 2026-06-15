/// Car dynamics telemetry — high-frequency vehicle motion data.
///
/// Contains speed, RPM, gear, steering, velocity vectors, acceleration,
/// orientation, and shift timing indicators.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
use serde::{Deserialize, Serialize};

use crate::model::flags::RaceFlags;

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CarDynamicsFrame {
    /// Vehicle speed in meters/sec
    /// @see https://sajax.github.io/irsdkdocs/telemetry/speed/
    pub speed: f32,

    /// Engine revolutions per minute
    /// @see https://sajax.github.io/irsdkdocs/telemetry/rpm/
    pub rpm: f32,

    /// Current gear: -1=Reverse, 0=Neutral, 1..n=Forward
    /// @see https://sajax.github.io/irsdkdocs/telemetry/gear/
    pub gear: i32,

    /// Steering wheel angle in radians
    /// @see https://sajax.github.io/irsdkdocs/telemetry/steeringwheelangle/
    pub steering_wheel_angle: f32,

    /// Vehicle velocity along X axis (lateral) in m/s
    /// @see https://sajax.github.io/irsdkdocs/telemetry/velocityx/
    pub velocity_x: Option<f32>,

    /// Vehicle velocity along Y axis (vertical) in m/s
    /// @see https://sajax.github.io/irsdkdocs/telemetry/velocityy/
    pub velocity_y: Option<f32>,

    /// Vehicle velocity along Z axis (forward) in m/s
    /// @see https://sajax.github.io/irsdkdocs/telemetry/velocityz/
    pub velocity_z: Option<f32>,

    /// Lateral acceleration in m/s²
    /// @see https://sajax.github.io/irsdkdocs/telemetry/lataccel/
    pub lat_accel: Option<f32>,

    /// Longitudinal acceleration in m/s²
    /// @see https://sajax.github.io/irsdkdocs/telemetry/longaccel/
    pub long_accel: Option<f32>,

    /// Yaw angle (heading) in radians
    /// @see https://sajax.github.io/irsdkdocs/telemetry/yaw/
    pub yaw: Option<f32>,

    /// Yaw rate (rotation speed) in rad/s
    /// @see https://sajax.github.io/irsdkdocs/telemetry/yawrate/
    pub yaw_rate: Option<f32>,

    /// Pitch angle in radians
    /// @see https://sajax.github.io/irsdkdocs/telemetry/pitch/
    pub pitch: Option<f32>,

    /// Roll angle in radians
    /// @see https://sajax.github.io/irsdkdocs/telemetry/roll/
    pub roll: Option<f32>,

    /// Shift indicator: 0.0 (idle) to 1.0 (shift now)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/shiftindicatorpct/
    pub shift_indicator_pct: Option<f32>,

    /// RPM at which grinding occurs during shift
    /// @see https://sajax.github.io/irsdkdocs/telemetry/shiftgrindrpm/
    pub shift_grind_rpm: Option<f32>,
}

/// Car input telemetry — driver pedal input data.
///
/// Contains throttle, brake, and clutch pedal positions.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CarInputsFrame {
    /// Throttle pedal position: 0.0 (released) to 1.0 (fully pressed)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/throttle/
    pub throttle: f32,

    /// Brake pedal position: 0.0 (released) to 1.0 (fully pressed)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/brake/
    pub brake: f32,

    /// Clutch pedal: 0.0 = disengaged (pedal pressed), 1.0 = engaged (pedal released).
    /// Note: iRacing provides clutch engagement, not pedal input.
    /// @see https://sajax.github.io/irsdkdocs/telemetry/clutch/
    pub clutch: Option<f32>,

    /// True if ABS is active
    /// @see https://sajax.github.io/irsdkdocs/telemetry/brakeabsactive/
    pub brake_abs_active: bool,
}

/// Car status telemetry — vehicle systems, fuel, engine, and pit state.
///
/// Contains fuel levels, engine temperatures, voltage, oil pressure,
/// and pit road / on track indicators.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CarStatusFrame {
    /// Fuel level in liters
    /// @see https://sajax.github.io/irsdkdocs/telemetry/fuellevel/
    pub fuel_level: f32,

    /// Fuel level as percentage: 0.0 to 1.0
    /// @see https://sajax.github.io/irsdkdocs/telemetry/fuellevelpct/
    pub fuel_level_pct: Option<f32>,

    /// Fuel consumption rate in kg/h
    /// @see https://sajax.github.io/irsdkdocs/telemetry/fueluseperhour/
    pub fuel_use_per_hour: Option<f32>,

    /// Engine oil temperature in °C
    /// @see https://sajax.github.io/irsdkdocs/telemetry/oiltemp/
    pub oil_temp: Option<f32>,

    /// Engine oil pressure in kPa
    /// @see https://sajax.github.io/irsdkdocs/telemetry/oilpress/
    pub oil_press: Option<f32>,

    /// Engine water temperature in °C
    /// @see https://sajax.github.io/irsdkdocs/telemetry/watertemp/
    pub water_temp: Option<f32>,

    /// Electrical system voltage
    /// @see https://sajax.github.io/irsdkdocs/telemetry/voltage/
    pub voltage: Option<f32>,

    /// Whether car is on pit road
    /// @see https://sajax.github.io/irsdkdocs/telemetry/onpitroad/
    pub on_pit_road: Option<bool>,

    /// Whether car is on track (not in garage/pits)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/isontrack/
    pub is_on_track: Option<bool>,

    /// Proximity indicator bit field for cars nearby
    /// @see https://sajax.github.io/irsdkdocs/telemetry/carleftright/
    pub car_left_right: Option<i32>,

    /// Engine warning bitmask; bit 0x10 = pit speed limiter active
    /// @see https://sajax.github.io/irsdkdocs/telemetry/enginewarnings/
    pub engine_warnings: Option<u32>,

    /// Per-gear RPM threshold at which shift lights turn fully on (one value per gear, index = gear number)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/playercarslshiftrpm/
    pub player_car_sl_shift_rpm: Vec<f32>,

    /// Per-gear RPM threshold at which shift lights blink (one value per gear, index = gear number)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/playercarslblinkrpm/
    pub player_car_sl_blink_rpm: Vec<f32>,

    /// Decoded race flag state for the session and the player's car.
    pub flags: RaceFlags,
}

// iRacing emits uninitialized memory (garbage floats or zeroes) for temp fields
// during car swap. Real engine temps are always > 0°C, so anything <= 0 is invalid SDK state.

/// Chassis telemetry — per-wheel tire and suspension data.
///
/// Contains ride height, shock deflection, tire temperatures (3 zones),
/// tire pressure, tire wear, and brake disc temperatures for all 4 corners.
///
/// All distance values are in meters (convert to mm on the frontend).
/// All temperature values are in °C. Pressure in kPa. Wear in 0.0–1.0.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChassisFrame {
    // === Ride Height (meters) ===
    pub lf_ride_height: Option<f32>,
    pub rf_ride_height: Option<f32>,
    pub lr_ride_height: Option<f32>,
    pub rr_ride_height: Option<f32>,

    // === Shock Deflection (meters) ===
    pub lf_shock_defl: Option<f32>,
    pub rf_shock_defl: Option<f32>,
    pub lr_shock_defl: Option<f32>,
    pub rr_shock_defl: Option<f32>,

    // === Tire Temperatures °C (inner / middle / outer) ===
    pub lf_temp_cl: Option<f32>,
    pub lf_temp_cm: Option<f32>,
    pub lf_temp_cr: Option<f32>,
    pub rf_temp_cl: Option<f32>,
    pub rf_temp_cm: Option<f32>,
    pub rf_temp_cr: Option<f32>,
    pub lr_temp_cl: Option<f32>,
    pub lr_temp_cm: Option<f32>,
    pub lr_temp_cr: Option<f32>,
    pub rr_temp_cl: Option<f32>,
    pub rr_temp_cm: Option<f32>,
    pub rr_temp_cr: Option<f32>,

    // === Tire Pressure (kPa) ===
    pub lf_pressure: Option<f32>,
    pub rf_pressure: Option<f32>,
    pub lr_pressure: Option<f32>,
    pub rr_pressure: Option<f32>,

    // === Tire Wear (0.0–1.0, inner / middle / outer) ===
    pub lf_wear_l: Option<f32>,
    pub lf_wear_m: Option<f32>,
    pub lf_wear_r: Option<f32>,
    pub rf_wear_l: Option<f32>,
    pub rf_wear_m: Option<f32>,
    pub rf_wear_r: Option<f32>,
    pub lr_wear_l: Option<f32>,
    pub lr_wear_m: Option<f32>,
    pub lr_wear_r: Option<f32>,
    pub rr_wear_l: Option<f32>,
    pub rr_wear_m: Option<f32>,
    pub rr_wear_r: Option<f32>,

    // === Brake Disc Temperature (°C) ===
    pub lf_brake_temp: Option<f32>,
    pub rf_brake_temp: Option<f32>,
    pub lr_brake_temp: Option<f32>,
    pub rr_brake_temp: Option<f32>,
}

/// Lap timing telemetry — lap times, distances, and race positions.
///
/// Contains current/last/best lap times, distance around track,
/// and overall/class position standings.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
pub struct LapTimingFrame {
    /// Current lap number
    /// @see https://sajax.github.io/irsdkdocs/telemetry/lap/
    pub lap: Option<i32>,

    /// Distance traveled on current lap in meters
    /// @see https://sajax.github.io/irsdkdocs/telemetry/lapdist/
    pub lap_dist: Option<f32>,

    /// Percentage of current lap completed: 0.0 to 1.0
    /// @see https://sajax.github.io/irsdkdocs/telemetry/lapdistpct/
    pub lap_dist_pct: Option<f32>,

    /// Current lap time in seconds
    /// @see https://sajax.github.io/irsdkdocs/telemetry/lapcurrentlaptime/
    pub lap_current_lap_time: f32,

    /// Last completed lap time in seconds
    /// @see https://sajax.github.io/irsdkdocs/telemetry/laplastlaptime/
    pub lap_last_lap_time: Option<f32>,

    /// Best lap time in seconds
    /// @see https://sajax.github.io/irsdkdocs/telemetry/lapbestlaptime/
    pub lap_best_lap_time: Option<f32>,

    /// Player's overall position in the race
    /// @see https://sajax.github.io/irsdkdocs/telemetry/playercarposition/
    pub player_car_position: Option<i32>,

    /// Player's position within their car class
    /// @see https://sajax.github.io/irsdkdocs/telemetry/playercarclassposition/
    pub player_car_class_position: Option<i32>,

    /// Live delta to session best lap
    pub lap_delta_to_session_best_live: Option<f32>,

    /// Live delta to session optimal lap
    pub lap_delta_to_session_optimal_live: Option<f32>,

    /// Live delta to driver's personal best lap
    pub lap_delta_to_driver_best_live: Option<f32>,
    pub lap_delta_to_best_lap: Option<f32>,
    pub lap_delta_to_best_lap_dd: Option<bool>,
    pub lap_delta_to_best_lap_ok: Option<bool>,
    pub lap_delta_to_optimal_lap: Option<f32>,
    pub lap_delta_to_optimal_lap_dd: Option<bool>,
    pub lap_delta_to_optimal_lap_ok: Option<bool>,
    pub lap_delta_to_session_best_lap: Option<f32>,
    pub lap_delta_to_session_best_lap_dd: Option<bool>,
    pub lap_delta_to_session_best_lap_ok: Option<bool>,
    pub lap_delta_to_session_lastl_lap: Option<f32>,
    pub lap_delta_to_session_lastl_lap_dd: Option<bool>,
    pub lap_delta_to_session_lastl_lap_ok: Option<bool>,
    pub lap_delta_to_session_optimal_lap: Option<f32>,
    pub lap_delta_to_session_optimal_lap_dd: Option<bool>,
    pub lap_delta_to_session_optimal_lap_ok: Option<bool>,
}
