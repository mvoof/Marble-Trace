//! iRacing frame mapping: kerb IracingFrame → domain model frames.
//!
//! A single `IracingFrame` snapshot is adapted directly into `SourceFrame`,
//! which holds the 9 pre-built domain frames consumed by the telemetry emitter.
//!
//! @see https://sajax.github.io/irsdkdocs/telemetry/

use crate::model::cars::{CarIdxFrame, CarPositionsFrame, SpotterState};
use crate::model::enums::{SessionState, Skies, TrackSurface};
use crate::model::environment::EnvironmentFrame;
use crate::model::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame,
    PitServiceFrame, PIT_SV_FAST_REPAIR, PIT_SV_FUEL_FILL, PIT_SV_LF_TIRE_CHANGE,
    PIT_SV_LR_TIRE_CHANGE, PIT_SV_RF_TIRE_CHANGE, PIT_SV_RR_TIRE_CHANGE, PIT_SV_WINDSHIELD_TEAROFF,
};
use crate::model::session::SessionFrame;
use crate::model::sim_perf::SimPerfFrame;
use crate::sources::iracing::flags::decode_race_flags;
use crate::sources::source::SourceFrame;
use kerb::iracing::IracingFrame;
use std::collections::HashSet;

impl From<&IracingFrame> for SourceFrame {
    fn from(f: &IracingFrame) -> Self {
        Self {
            car_dynamics: CarDynamicsFrame::from(f),
            car_inputs: CarInputsFrame::from(f),
            car_positions: CarPositionsFrame::from(f),
            car_idx: CarIdxFrame::from(f),
            chassis: ChassisFrame::from(f),
            lap_timing: LapTimingFrame::from(f),
            car_status: CarStatusFrame::from(f),
            pit_service: PitServiceFrame::from(f),
            session: SessionFrame::from(f),
            environment: EnvironmentFrame::from(f),
            sim_perf: SimPerfFrame::from(f),
        }
    }
}

impl From<&IracingFrame> for SimPerfFrame {
    fn from(f: &IracingFrame) -> Self {
        Self {
            frame_rate: Some(f.frame_rate),
            gpu_usage: Some(f.gpu_usage),
            cpu_usage_fg: Some(f.cpu_usage_fg),
        }
    }
}

impl From<&IracingFrame> for CarDynamicsFrame {
    fn from(f: &IracingFrame) -> Self {
        Self {
            speed: f.speed,
            rpm: f.rpm,
            gear: f.gear,
            steering_wheel_angle: f.steering_wheel_angle,
            velocity_x: Some(f.velocity_x),
            velocity_y: Some(f.velocity_y),
            velocity_z: Some(f.velocity_z),
            lat_accel: Some(f.lat_accel),
            long_accel: Some(f.long_accel),
            yaw: Some(f.yaw),
            yaw_rate: Some(f.yaw_rate),
            pitch: Some(f.pitch),
            roll: Some(f.roll),
            shift_indicator_pct: Some(f.shift_indicator_pct),
            shift_grind_rpm: Some(f.shift_grind_rpm),
        }
    }
}

impl From<&IracingFrame> for CarInputsFrame {
    fn from(f: &IracingFrame) -> Self {
        Self {
            throttle: f.throttle,
            brake: f.brake,
            clutch: Some(f.clutch),
            brake_abs_active: f.brake_abs_active,
        }
    }
}

const TEMP_MAX_C: f32 = 400.0;

fn sanitize_temp(v: f32) -> Option<f32> {
    if v.is_finite() && v > 0.0 && v <= TEMP_MAX_C {
        Some(v)
    } else {
        None
    }
}

impl From<&IracingFrame> for CarStatusFrame {
    fn from(f: &IracingFrame) -> Self {
        let session_bits = f.session_flags as u32;
        let player_car_bits = f
            .car_idx_session_flags
            .get(f.player_car_idx as usize)
            .map(|&v| v as u32)
            .unwrap_or(0);

        Self {
            fuel_level: f.fuel_level,
            fuel_level_pct: Some(f.fuel_level_pct),
            fuel_use_per_hour: Some(f.fuel_use_per_hour),
            oil_temp: sanitize_temp(f.oil_temp),
            oil_press: Some(f.oil_press),
            water_temp: sanitize_temp(f.water_temp),
            voltage: Some(f.voltage),
            on_pit_road: Some(f.on_pit_road),
            is_on_track: Some(f.is_on_track),
            spotter: Some(spotter_from_iracing(f.car_left_right)),
            engine_warnings: Some(f.engine_warnings as u32),
            player_car_sl_shift_rpm: vec![f.player_car_sl_shift_rpm],
            player_car_sl_blink_rpm: vec![f.player_car_sl_blink_rpm],
            flags: decode_race_flags(session_bits, player_car_bits),
            dc_abs: Some(f.dc_abs),
            dc_brake_bias: Some(f.dc_brake_bias),
            dc_traction_control: Some(f.dc_traction_control),
            dc_throttle_shape: Some(f.dc_throttle_shape),
            dc_traction_control_2: Some(f.dc_traction_control2),
            dc_engine_braking: Some(f.dc_engine_braking),
            dc_brake_bias_fine: Some(f.dc_brake_bias_fine),
            dc_peak_brake_bias: Some(f.dc_peak_brake_bias),
            dc_diff_entry: Some(f.dc_diff_entry),
            dc_diff_middle: Some(f.dc_diff_middle),
            dc_diff_exit: Some(f.dc_diff_exit),
            energy_ers_battery_pct: Some(f.energy_ers_battery_pct),
            power_mgu_k: Some(f.power_mgu_k),
            energy_battery_to_mgu_k_lap: Some(f.energy_battery_to_mgu_k_lap),
            dc_mguk_deploy_mode: Some(f.dc_mguk_deploy_mode),
        }
    }
}

/// The variable names this car actually declares, captured once per connection.
///
/// `IracingFrame` is a fixed struct: a field the car never declared resolves to
/// no offset and reads back as a default, which is indistinguishable from a real
/// zero. A GT3 would therefore report a 0% hybrid battery rather than no battery
/// at all. The var list is the only place that distinction survives, so it is
/// taken at connect and every optional field that is not universal is cleared
/// against it before the frame leaves this layer.
#[derive(Debug, Default, Clone)]
pub struct DeclaredVars(HashSet<String>);

/// Fields cleared when the car does not declare them, paired with the SDK
/// variable each one reads. Universal fields (fuel, temps, flags) are absent on
/// purpose — every car has them, and a car that somehow does not is a defect
/// worth seeing rather than hiding.
type ClearCarStatusField = fn(&mut CarStatusFrame);

const CAR_STATUS_OPTIONAL_VARS: &[(&str, ClearCarStatusField)] = &[
    ("dcABS", |s| s.dc_abs = None),
    ("dcBrakeBias", |s| s.dc_brake_bias = None),
    ("dcTractionControl", |s| s.dc_traction_control = None),
    ("dcThrottleShape", |s| s.dc_throttle_shape = None),
    ("dcTractionControl2", |s| s.dc_traction_control_2 = None),
    ("dcEngineBraking", |s| s.dc_engine_braking = None),
    ("dcBrakeBiasFine", |s| s.dc_brake_bias_fine = None),
    ("dcPeakBrakeBias", |s| s.dc_peak_brake_bias = None),
    ("dcDiffEntry", |s| s.dc_diff_entry = None),
    ("dcDiffMiddle", |s| s.dc_diff_middle = None),
    ("dcDiffExit", |s| s.dc_diff_exit = None),
    ("EnergyERSBatteryPct", |s| s.energy_ers_battery_pct = None),
    ("PowerMGU_K", |s| s.power_mgu_k = None),
    ("EnergyBatteryToMGU_KLap", |s| {
        s.energy_battery_to_mgu_k_lap = None
    }),
    ("dcMGUKDeployMode", |s| s.dc_mguk_deploy_mode = None),
];

impl DeclaredVars {
    pub fn new(names: impl IntoIterator<Item = String>) -> Self {
        Self(names.into_iter().collect())
    }

    /// True while nothing was captured — then nothing is cleared, so a source
    /// that could not read the var list degrades to the old behaviour instead of
    /// blanking every adjustment on the car.
    fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    pub fn mask_car_status(&self, status: &mut CarStatusFrame) {
        if self.is_empty() {
            return;
        }

        for (var, clear) in CAR_STATUS_OPTIONAL_VARS {
            if !self.0.contains(*var) {
                clear(status);
            }
        }
    }
}

impl From<&IracingFrame> for PitServiceFrame {
    fn from(f: &IracingFrame) -> Self {
        let flags = f.pit_sv_flags as u32;

        Self {
            flags: Some(flags),
            change_lf: flags & PIT_SV_LF_TIRE_CHANGE != 0,
            change_rf: flags & PIT_SV_RF_TIRE_CHANGE != 0,
            change_lr: flags & PIT_SV_LR_TIRE_CHANGE != 0,
            change_rr: flags & PIT_SV_RR_TIRE_CHANGE != 0,
            add_fuel: flags & PIT_SV_FUEL_FILL != 0,
            clean_windshield: flags & PIT_SV_WINDSHIELD_TEAROFF != 0,
            fast_repair: flags & PIT_SV_FAST_REPAIR != 0,
            fuel_amount: Some(f.pit_sv_fuel),
            lf_pressure: Some(f.pit_sv_lfp),
            rf_pressure: Some(f.pit_sv_rfp),
            lr_pressure: Some(f.pit_sv_lrp),
            rr_pressure: Some(f.pit_sv_rrp),
            tire_compound: Some(f.pit_sv_tire_compound),
            repair_left_s: Some(f.pit_repair_left),
            opt_repair_left_s: Some(f.pit_opt_repair_left),
            tow_time_s: Some(f.player_car_tow_time),
            fast_repairs_available: Some(f.fast_repair_available),
            fast_repairs_used: Some(f.player_fast_repairs_used),
            service_status: Some(f.player_car_pit_sv_status),
            in_pit_stall: f.player_car_in_pit_stall,
            service_active: f.pitstop_active,
        }
    }
}

impl From<&IracingFrame> for ChassisFrame {
    fn from(f: &IracingFrame) -> Self {
        Self {
            lf_ride_height: None,
            rf_ride_height: None,
            lr_ride_height: None,
            rr_ride_height: None,
            lf_shock_defl: Some(f.lf_shock_defl),
            rf_shock_defl: Some(f.rf_shock_defl),
            lr_shock_defl: Some(f.lr_shock_defl),
            rr_shock_defl: Some(f.rr_shock_defl),
            lf_temp_cl: Some(f.lf_temp_cl),
            lf_temp_cm: Some(f.lf_temp_cm),
            lf_temp_cr: Some(f.lf_temp_cr),
            rf_temp_cl: Some(f.rf_temp_cl),
            rf_temp_cm: Some(f.rf_temp_cm),
            rf_temp_cr: Some(f.rf_temp_cr),
            lr_temp_cl: Some(f.lr_temp_cl),
            lr_temp_cm: Some(f.lr_temp_cm),
            lr_temp_cr: Some(f.lr_temp_cr),
            rr_temp_cl: Some(f.rr_temp_cl),
            rr_temp_cm: Some(f.rr_temp_cm),
            rr_temp_cr: Some(f.rr_temp_cr),
            lf_pressure: Some(f.lf_cold_pressure),
            rf_pressure: Some(f.rf_cold_pressure),
            lr_pressure: Some(f.lr_cold_pressure),
            rr_pressure: Some(f.rr_cold_pressure),
            lf_wear_l: Some(f.lf_wear_l),
            lf_wear_m: Some(f.lf_wear_m),
            lf_wear_r: Some(f.lf_wear_r),
            rf_wear_l: Some(f.rf_wear_l),
            rf_wear_m: Some(f.rf_wear_m),
            rf_wear_r: Some(f.rf_wear_r),
            lr_wear_l: Some(f.lr_wear_l),
            lr_wear_m: Some(f.lr_wear_m),
            lr_wear_r: Some(f.lr_wear_r),
            rr_wear_l: Some(f.rr_wear_l),
            rr_wear_m: Some(f.rr_wear_m),
            rr_wear_r: Some(f.rr_wear_r),
            lf_brake_temp: None,
            rf_brake_temp: None,
            lr_brake_temp: None,
            rr_brake_temp: None,
        }
    }
}

impl From<&IracingFrame> for LapTimingFrame {
    fn from(f: &IracingFrame) -> Self {
        Self {
            lap: Some(f.lap),
            lap_dist: Some(f.lap_dist),
            lap_dist_pct: Some(f.lap_dist_pct),
            lap_current_lap_time: f.lap_current_lap_time,
            lap_last_lap_time: Some(f.lap_last_lap_time),
            lap_best_lap_time: Some(f.lap_best_lap_time),
            player_car_position: Some(f.player_car_position),
            player_car_class_position: Some(f.player_car_class_position),
            lap_delta_to_session_best_live: None,
            lap_delta_to_session_optimal_live: None,
            lap_delta_to_driver_best_live: None,
            lap_delta_to_best_lap: Some(f.lap_delta_to_best_lap),
            lap_delta_to_best_lap_dd: Some(f.lap_delta_to_best_lap_dd != 0.0),
            lap_delta_to_best_lap_ok: Some(f.lap_delta_to_best_lap_ok),
            lap_delta_to_optimal_lap: Some(f.lap_delta_to_optimal_lap),
            lap_delta_to_optimal_lap_dd: Some(f.lap_delta_to_optimal_lap_dd != 0.0),
            lap_delta_to_optimal_lap_ok: Some(f.lap_delta_to_optimal_lap_ok),
            lap_delta_to_session_best_lap: Some(f.lap_delta_to_session_best_lap),
            lap_delta_to_session_best_lap_dd: Some(f.lap_delta_to_session_best_lap_dd != 0.0),
            lap_delta_to_session_best_lap_ok: Some(f.lap_delta_to_session_best_lap_ok),
            lap_delta_to_session_lastl_lap: Some(f.lap_delta_to_session_lastl_lap),
            lap_delta_to_session_lastl_lap_dd: Some(f.lap_delta_to_session_lastl_lap_dd != 0.0),
            lap_delta_to_session_lastl_lap_ok: Some(f.lap_delta_to_session_lastl_lap_ok),
            lap_delta_to_session_optimal_lap: Some(f.lap_delta_to_session_optimal_lap),
            lap_delta_to_session_optimal_lap_dd: Some(f.lap_delta_to_session_optimal_lap_dd != 0.0),
            lap_delta_to_session_optimal_lap_ok: Some(f.lap_delta_to_session_optimal_lap_ok),
        }
    }
}

impl From<&IracingFrame> for SessionFrame {
    fn from(f: &IracingFrame) -> Self {
        let player_car_flags = f
            .car_idx_session_flags
            .get(f.player_car_idx as usize)
            .map(|&flags| flags as u32);

        Self {
            session_time: Some(f.session_time),
            session_time_remain: Some(f.session_time_remain),
            session_laps_remain_ex: Some(f.session_laps_remain_ex),
            session_state: Some(SessionState::from(f.session_state)),
            session_flags: Some(f.session_flags as u32),
            session_num: Some(f.session_num),
            session_time_of_day: Some(f.session_time_of_day),
            player_car_idx: Some(f.player_car_idx),
            player_car_flags,
        }
    }
}

impl From<&IracingFrame> for EnvironmentFrame {
    fn from(f: &IracingFrame) -> Self {
        Self {
            air_temp: Some(f.air_temp),
            track_temp: Some(f.track_temp_crew),
            wind_vel: Some(f.wind_vel),
            wind_dir: Some(f.wind_dir),
            relative_humidity: Some(f.relative_humidity),
            skies: Some(Skies::from(f.skies)),
            precipitation: Some(f.precipitation),
            track_wetness: Some(f.track_wetness),
            weather_declared_wet: Some(f.weather_declared_wet),
        }
    }
}

impl From<&IracingFrame> for CarIdxFrame {
    fn from(f: &IracingFrame) -> Self {
        Self {
            car_idx_lap_dist_pct: f.car_idx_lap_dist_pct.clone(),
            car_idx_on_pit_road: f.car_idx_on_pit_road.clone(),
            car_idx_position: f.car_idx_position.clone(),
            car_idx_class_position: f.car_idx_class_position.clone(),
            car_idx_lap: f.car_idx_lap.clone(),
            car_idx_laps_completed: f.car_idx_lap_completed.clone(),
            car_idx_last_lap_time: f.car_idx_last_lap_time.clone(),
            car_idx_best_lap_time: f.car_idx_best_lap_time.clone(),
            car_idx_f2_time: f.car_idx_f2_time.clone(),
            car_idx_est_time: f.car_idx_est_time.clone(),
            car_idx_track_surface: f
                .car_idx_track_surface
                .iter()
                .map(|&v| TrackSurface::from(v))
                .collect(),
            car_idx_tire_compound: f.car_idx_tire_compound.clone(),
            car_idx_session_flags: f
                .car_idx_session_flags
                .iter()
                .map(|&flags| flags as u32)
                .collect(),
            spotter: Some(spotter_from_iracing(f.car_left_right)),
        }
    }
}

impl From<&IracingFrame> for CarPositionsFrame {
    fn from(f: &IracingFrame) -> Self {
        Self {
            car_idx_lap_dist_pct: f.car_idx_lap_dist_pct.clone(),
            car_idx_track_surface: f.car_idx_track_surface.clone(),
        }
    }
}

/// `CarLeftRight` is an iRacing enum sent as a plain integer; this is the only
/// place that knows what those numbers mean.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/carleftright/
fn spotter_from_iracing(raw: i32) -> SpotterState {
    match raw {
        0 => SpotterState::Off,
        1 => SpotterState::Clear,
        2 => SpotterState::CarLeft,
        3 => SpotterState::CarRight,
        4 => SpotterState::CarLeftRight,
        5 => SpotterState::TwoCarsLeft,
        6 => SpotterState::TwoCarsRight,
        // A value this build does not know reads as "nothing alongside" rather
        // than as an absent spotter, which is what an unmapped value did before.
        _ => SpotterState::Clear,
    }
}

#[cfg(test)]
mod spotter_tests {
    use super::*;

    // The numbers are the wire contract with the sim; nothing downstream can
    // catch a wrong one, because every value decodes to something plausible.
    #[test]
    fn decodes_every_car_left_right_value() {
        assert_eq!(spotter_from_iracing(0), SpotterState::Off);
        assert_eq!(spotter_from_iracing(1), SpotterState::Clear);
        assert_eq!(spotter_from_iracing(2), SpotterState::CarLeft);
        assert_eq!(spotter_from_iracing(3), SpotterState::CarRight);
        assert_eq!(spotter_from_iracing(4), SpotterState::CarLeftRight);
        assert_eq!(spotter_from_iracing(5), SpotterState::TwoCarsLeft);
        assert_eq!(spotter_from_iracing(6), SpotterState::TwoCarsRight);
    }

    // An unmapped value must not read as "spotter off" — that would switch
    // proximity to its geometry fallback for a car that is simply unknown.
    #[test]
    fn unknown_values_read_as_clear() {
        assert_eq!(spotter_from_iracing(-1), SpotterState::Clear);
        assert_eq!(spotter_from_iracing(99), SpotterState::Clear);
    }
}
