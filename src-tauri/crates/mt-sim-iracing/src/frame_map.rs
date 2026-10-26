//! iRacing frame mapping: kerb IracingFrame → domain model frames.
//!
//! A single `IracingFrame` snapshot is adapted directly into `SourceFrame`,
//! which holds the 9 pre-built domain frames consumed by the telemetry emitter.
//!
//! @see https://sajax.github.io/irsdkdocs/telemetry/

use crate::flags::decode_race_flags;
use kerb::iracing::IracingFrame;
use mt_model::sim::cars::{
    CarIdxFrame, CarPositionsFrame, PaceFormation, PacingFrame, SpotterState,
};
use mt_model::sim::enums::{DrsState, SessionState, Skies, TrackSurface};
use mt_model::sim::environment::EnvironmentFrame;
use mt_model::sim::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame,
    PitServiceFrame, PIT_SV_FAST_REPAIR, PIT_SV_FUEL_FILL, PIT_SV_LF_TIRE_CHANGE,
    PIT_SV_LR_TIRE_CHANGE, PIT_SV_RF_TIRE_CHANGE, PIT_SV_RR_TIRE_CHANGE, PIT_SV_WINDSHIELD_TEAROFF,
};
use mt_model::sim::radio::{RadioFrame, RadioTransmission};
use mt_model::sim::session::SessionFrame;
use mt_model::sim::sim_perf::SimPerfFrame;
use mt_source::SourceFrame;
use std::collections::HashSet;

/// kerb's frame mapped onto one of the model's. A trait of this crate rather
/// than `From`: both types are foreign here, and the orphan rule allows a
/// `From` between them only in the crate that declares one of them.
pub(crate) trait FromIracing {
    fn from_iracing(frame: &IracingFrame) -> Self;
}

impl FromIracing for SourceFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        Self {
            car_dynamics: CarDynamicsFrame::from_iracing(frame),
            car_inputs: CarInputsFrame::from_iracing(frame),
            car_positions: CarPositionsFrame::from_iracing(frame),
            car_idx: CarIdxFrame::from_iracing(frame),
            chassis: ChassisFrame::from_iracing(frame),
            lap_timing: LapTimingFrame::from_iracing(frame),
            car_status: CarStatusFrame::from_iracing(frame),
            pit_service: PitServiceFrame::from_iracing(frame),
            session: SessionFrame::from_iracing(frame),
            environment: EnvironmentFrame::from_iracing(frame),
            sim_perf: SimPerfFrame::from_iracing(frame),
            pacing: PacingFrame::from_iracing(frame),
            radio: RadioFrame::from_iracing(frame),
        }
    }
}

impl FromIracing for SimPerfFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        Self {
            frame_rate: Some(frame.frame_rate),
            gpu_usage: Some(frame.gpu_usage),
            cpu_usage_fg: Some(frame.cpu_usage_fg),
        }
    }
}

impl FromIracing for CarDynamicsFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        Self {
            speed: frame.speed,
            rpm: frame.rpm,
            gear: frame.gear,
            steering_wheel_angle: frame.steering_wheel_angle,
            velocity_x: Some(frame.velocity_x),
            velocity_y: Some(frame.velocity_y),
            velocity_z: Some(frame.velocity_z),
            lat_accel: Some(frame.lat_accel),
            long_accel: Some(frame.long_accel),
            yaw: Some(frame.yaw),
            yaw_rate: Some(frame.yaw_rate),
            pitch: Some(frame.pitch),
            roll: Some(frame.roll),
            shift_indicator_pct: Some(frame.shift_indicator_pct),
            shift_grind_rpm: Some(frame.shift_grind_rpm),
        }
    }
}

impl FromIracing for CarInputsFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        Self {
            throttle: frame.throttle,
            brake: frame.brake,
            clutch: Some(frame.clutch),
            brake_abs_active: frame.brake_abs_active,
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

impl FromIracing for CarStatusFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        let session_bits = frame.session_flags as u32;
        let player_car_bits = frame
            .car_idx_session_flags
            .get(frame.player_car_idx as usize)
            .map(|&v| v as u32)
            .unwrap_or(0);

        Self {
            fuel_level: frame.fuel_level,
            fuel_level_pct: Some(frame.fuel_level_pct),
            fuel_use_per_hour: Some(frame.fuel_use_per_hour),
            oil_temp: sanitize_temp(frame.oil_temp),
            oil_press: Some(frame.oil_press),
            water_temp: sanitize_temp(frame.water_temp),
            voltage: Some(frame.voltage),
            on_pit_road: Some(frame.on_pit_road),
            is_on_track: Some(frame.is_on_track),
            spotter: Some(spotter_from_iracing(frame.car_left_right)),
            engine_warnings: Some(frame.engine_warnings as u32),
            player_car_sl_shift_rpm: vec![frame.player_car_sl_shift_rpm],
            player_car_sl_blink_rpm: vec![frame.player_car_sl_blink_rpm],
            flags: decode_race_flags(session_bits, player_car_bits),
            dc_abs: Some(frame.dc_abs),
            dc_brake_bias: Some(frame.dc_brake_bias),
            dc_traction_control: Some(frame.dc_traction_control),
            dc_throttle_shape: Some(frame.dc_throttle_shape),
            dc_traction_control_2: Some(frame.dc_traction_control2),
            dc_engine_braking: Some(frame.dc_engine_braking),
            dc_brake_bias_fine: Some(frame.dc_brake_bias_fine),
            dc_peak_brake_bias: Some(frame.dc_peak_brake_bias),
            dc_anti_roll_front: Some(frame.dc_anti_roll_front),
            dc_anti_roll_rear: Some(frame.dc_anti_roll_rear),
            dc_brake_misc: Some(frame.dc_brake_misc),
            dc_diff_entry: Some(frame.dc_diff_entry),
            dc_diff_middle: Some(frame.dc_diff_middle),
            dc_diff_exit: Some(frame.dc_diff_exit),
            energy_ers_battery_pct: Some(frame.energy_ers_battery_pct),
            power_mgu_k: Some(frame.power_mgu_k),
            energy_battery_to_mgu_k_lap: Some(frame.energy_battery_to_mgu_k_lap),
            dc_mguk_deploy_mode: Some(frame.dc_mguk_deploy_mode),
            drs: Some(DrsState::from(frame.drs_status)),
            player_car_my_incident_count: Some(frame.player_car_my_incident_count),
            player_car_team_incident_count: Some(frame.player_car_team_incident_count),
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
    ("dcAntiRollFront", |s| s.dc_anti_roll_front = None),
    ("dcAntiRollRear", |s| s.dc_anti_roll_rear = None),
    ("dcBrakeMisc", |s| s.dc_brake_misc = None),
    ("dcDiffEntry", |s| s.dc_diff_entry = None),
    ("dcDiffMiddle", |s| s.dc_diff_middle = None),
    ("dcDiffExit", |s| s.dc_diff_exit = None),
    ("EnergyERSBatteryPct", |s| s.energy_ers_battery_pct = None),
    ("PowerMGU_K", |s| s.power_mgu_k = None),
    ("EnergyBatteryToMGU_KLap", |s| {
        s.energy_battery_to_mgu_k_lap = None
    }),
    ("dcMGUKDeployMode", |s| s.dc_mguk_deploy_mode = None),
    ("DRS_Status", |s| s.drs = None),
];

const RADIO_TRANSMIT_CAR_IDX_VAR: &str = "RadioTransmitCarIdx";

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

    /// kerb reads a variable the sim did not declare as 0 — a real car index —
    /// so without the variable nobody is talking rather than car 0 for ever.
    pub fn mask_radio(&self, radio: &mut RadioFrame) {
        if !self.is_empty() && !self.0.contains(RADIO_TRANSMIT_CAR_IDX_VAR) {
            radio.transmission = None;
        }
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

impl FromIracing for PitServiceFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        let flags = frame.pit_sv_flags as u32;

        Self {
            flags: Some(flags),
            change_lf: flags & PIT_SV_LF_TIRE_CHANGE != 0,
            change_rf: flags & PIT_SV_RF_TIRE_CHANGE != 0,
            change_lr: flags & PIT_SV_LR_TIRE_CHANGE != 0,
            change_rr: flags & PIT_SV_RR_TIRE_CHANGE != 0,
            add_fuel: flags & PIT_SV_FUEL_FILL != 0,
            clean_windshield: flags & PIT_SV_WINDSHIELD_TEAROFF != 0,
            fast_repair: flags & PIT_SV_FAST_REPAIR != 0,
            fuel_amount: Some(frame.pit_sv_fuel),
            lf_pressure: Some(frame.pit_sv_lfp),
            rf_pressure: Some(frame.pit_sv_rfp),
            lr_pressure: Some(frame.pit_sv_lrp),
            rr_pressure: Some(frame.pit_sv_rrp),
            tire_compound: Some(frame.pit_sv_tire_compound),
            repair_left_s: Some(frame.pit_repair_left),
            opt_repair_left_s: Some(frame.pit_opt_repair_left),
            tow_time_s: Some(frame.player_car_tow_time),
            fast_repairs_available: Some(frame.fast_repair_available),
            fast_repairs_used: Some(frame.player_fast_repairs_used),
            service_status: Some(frame.player_car_pit_sv_status),
            in_pit_stall: frame.player_car_in_pit_stall,
            service_active: frame.pitstop_active,
        }
    }
}

impl FromIracing for ChassisFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        Self {
            lf_ride_height: None,
            rf_ride_height: None,
            lr_ride_height: None,
            rr_ride_height: None,
            lf_shock_defl: Some(frame.lf_shock_defl),
            rf_shock_defl: Some(frame.rf_shock_defl),
            lr_shock_defl: Some(frame.lr_shock_defl),
            rr_shock_defl: Some(frame.rr_shock_defl),
            lf_temp_cl: Some(frame.lf_temp_cl),
            lf_temp_cm: Some(frame.lf_temp_cm),
            lf_temp_cr: Some(frame.lf_temp_cr),
            rf_temp_cl: Some(frame.rf_temp_cl),
            rf_temp_cm: Some(frame.rf_temp_cm),
            rf_temp_cr: Some(frame.rf_temp_cr),
            lr_temp_cl: Some(frame.lr_temp_cl),
            lr_temp_cm: Some(frame.lr_temp_cm),
            lr_temp_cr: Some(frame.lr_temp_cr),
            rr_temp_cl: Some(frame.rr_temp_cl),
            rr_temp_cm: Some(frame.rr_temp_cm),
            rr_temp_cr: Some(frame.rr_temp_cr),
            lf_pressure: Some(frame.lf_cold_pressure),
            rf_pressure: Some(frame.rf_cold_pressure),
            lr_pressure: Some(frame.lr_cold_pressure),
            rr_pressure: Some(frame.rr_cold_pressure),
            lf_wear_l: Some(frame.lf_wear_l),
            lf_wear_m: Some(frame.lf_wear_m),
            lf_wear_r: Some(frame.lf_wear_r),
            rf_wear_l: Some(frame.rf_wear_l),
            rf_wear_m: Some(frame.rf_wear_m),
            rf_wear_r: Some(frame.rf_wear_r),
            lr_wear_l: Some(frame.lr_wear_l),
            lr_wear_m: Some(frame.lr_wear_m),
            lr_wear_r: Some(frame.lr_wear_r),
            rr_wear_l: Some(frame.rr_wear_l),
            rr_wear_m: Some(frame.rr_wear_m),
            rr_wear_r: Some(frame.rr_wear_r),
            lf_brake_temp: None,
            rf_brake_temp: None,
            lr_brake_temp: None,
            rr_brake_temp: None,
        }
    }
}

impl FromIracing for LapTimingFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        Self {
            lap: Some(frame.lap),
            lap_dist: Some(frame.lap_dist),
            lap_dist_pct: Some(frame.lap_dist_pct),
            lap_current_lap_time: frame.lap_current_lap_time,
            lap_last_lap_time: Some(frame.lap_last_lap_time),
            lap_best_lap_time: Some(frame.lap_best_lap_time),
            player_car_position: Some(frame.player_car_position),
            player_car_class_position: Some(frame.player_car_class_position),
            lap_delta_to_session_best_live: None,
            lap_delta_to_session_optimal_live: None,
            lap_delta_to_driver_best_live: None,
            lap_delta_to_best_lap: Some(frame.lap_delta_to_best_lap),
            lap_delta_to_best_lap_dd: Some(frame.lap_delta_to_best_lap_dd != 0.0),
            lap_delta_to_best_lap_ok: Some(frame.lap_delta_to_best_lap_ok),
            lap_delta_to_optimal_lap: Some(frame.lap_delta_to_optimal_lap),
            lap_delta_to_optimal_lap_dd: Some(frame.lap_delta_to_optimal_lap_dd != 0.0),
            lap_delta_to_optimal_lap_ok: Some(frame.lap_delta_to_optimal_lap_ok),
            lap_delta_to_session_best_lap: Some(frame.lap_delta_to_session_best_lap),
            lap_delta_to_session_best_lap_dd: Some(frame.lap_delta_to_session_best_lap_dd != 0.0),
            lap_delta_to_session_best_lap_ok: Some(frame.lap_delta_to_session_best_lap_ok),
            lap_delta_to_session_lastl_lap: Some(frame.lap_delta_to_session_lastl_lap),
            lap_delta_to_session_lastl_lap_dd: Some(frame.lap_delta_to_session_lastl_lap_dd != 0.0),
            lap_delta_to_session_lastl_lap_ok: Some(frame.lap_delta_to_session_lastl_lap_ok),
            lap_delta_to_session_optimal_lap: Some(frame.lap_delta_to_session_optimal_lap),
            lap_delta_to_session_optimal_lap_dd: Some(
                frame.lap_delta_to_session_optimal_lap_dd != 0.0,
            ),
            lap_delta_to_session_optimal_lap_ok: Some(frame.lap_delta_to_session_optimal_lap_ok),
        }
    }
}

impl FromIracing for SessionFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        let player_car_flags = frame
            .car_idx_session_flags
            .get(frame.player_car_idx as usize)
            .map(|&flags| flags as u32);

        Self {
            session_time: Some(frame.session_time),
            session_time_remain: Some(frame.session_time_remain),
            session_laps_remain_ex: Some(frame.session_laps_remain_ex),
            session_state: Some(SessionState::from(frame.session_state)),
            session_flags: Some(frame.session_flags as u32),
            session_num: Some(frame.session_num),
            session_time_of_day: Some(frame.session_time_of_day),
            player_car_idx: Some(frame.player_car_idx),
            player_car_flags,
        }
    }
}

impl FromIracing for EnvironmentFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        Self {
            air_temp: Some(frame.air_temp),
            track_temp: Some(frame.track_temp_crew),
            wind_vel: Some(frame.wind_vel),
            wind_dir: Some(frame.wind_dir),
            relative_humidity: Some(frame.relative_humidity),
            skies: Some(Skies::from(frame.skies)),
            precipitation: Some(frame.precipitation),
            track_wetness: Some(frame.track_wetness),
            weather_declared_wet: Some(frame.weather_declared_wet),
        }
    }
}

impl FromIracing for CarIdxFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        Self {
            car_idx_lap_dist_pct: frame.car_idx_lap_dist_pct.clone(),
            car_idx_on_pit_road: frame.car_idx_on_pit_road.clone(),
            car_idx_position: frame.car_idx_position.clone(),
            car_idx_class_position: frame.car_idx_class_position.clone(),
            car_idx_lap: frame.car_idx_lap.clone(),
            car_idx_laps_completed: frame.car_idx_lap_completed.clone(),
            car_idx_last_lap_time: frame.car_idx_last_lap_time.clone(),
            car_idx_best_lap_time: frame.car_idx_best_lap_time.clone(),
            car_idx_f2_time: frame.car_idx_f2_time.clone(),
            car_idx_est_time: frame.car_idx_est_time.clone(),
            car_idx_track_surface: frame
                .car_idx_track_surface
                .iter()
                .map(|&v| TrackSurface::from(v))
                .collect(),
            car_idx_tire_compound: frame.car_idx_tire_compound.clone(),
            car_idx_session_flags: frame
                .car_idx_session_flags
                .iter()
                .map(|&flags| flags as u32)
                .collect(),
            spotter: Some(spotter_from_iracing(frame.car_left_right)),
        }
    }
}

impl FromIracing for CarPositionsFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        Self {
            car_idx_lap_dist_pct: frame.car_idx_lap_dist_pct.clone(),
            car_idx_track_surface: frame.car_idx_track_surface.clone(),
        }
    }
}

impl FromIracing for PacingFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        Self {
            formation: pace_formation_from_iracing(frame.pace_mode),
            car_idx_pace_line: frame.car_idx_pace_line.clone(),
        }
    }
}

impl FromIracing for RadioFrame {
    fn from_iracing(frame: &IracingFrame) -> Self {
        Self {
            transmission: radio_transmission_from_iracing(
                frame.radio_transmit_car_idx,
                frame.radio_transmit_radio_idx,
                frame.radio_transmit_frequency_idx,
            ),
            push_to_talk: frame.push_to_talk,
        }
    }
}

/// `RadioTransmitCarIdx` is -1 while nobody is talking.
fn radio_transmission_from_iracing(
    car_idx: i32,
    radio_num: i32,
    frequency_num: i32,
) -> Option<RadioTransmission> {
    if car_idx < 0 {
        return None;
    }

    Some(RadioTransmission {
        car_idx,
        radio_num,
        frequency_num,
    })
}

/// `PaceMode` is an iRacing enum sent as a plain integer; this is the only
/// place that knows what those numbers mean.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/pacemode/
fn pace_formation_from_iracing(raw: i32) -> PaceFormation {
    match raw {
        0 | 2 => PaceFormation::SingleFile,
        1 | 3 => PaceFormation::DoubleFile,
        _ => PaceFormation::NotPacing,
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

    #[test]
    fn decodes_every_pace_mode_value() {
        assert_eq!(pace_formation_from_iracing(0), PaceFormation::SingleFile);
        assert_eq!(pace_formation_from_iracing(1), PaceFormation::DoubleFile);
        assert_eq!(pace_formation_from_iracing(2), PaceFormation::SingleFile);
        assert_eq!(pace_formation_from_iracing(3), PaceFormation::DoubleFile);
        assert_eq!(pace_formation_from_iracing(4), PaceFormation::NotPacing);
    }

    // An unmapped value must not read as "spotter off": the spotter is
    // talking, this build just does not know the word.
    #[test]
    fn nobody_talks_while_the_transmitter_is_minus_one() {
        assert_eq!(radio_transmission_from_iracing(-1, 0, 3), None);
        assert_eq!(
            radio_transmission_from_iracing(0, 0, 3),
            Some(RadioTransmission {
                car_idx: 0,
                radio_num: 0,
                frequency_num: 3,
            })
        );
    }

    #[test]
    fn a_sim_without_the_radio_variable_reads_as_silence() {
        let declared = DeclaredVars::new(["Speed".to_string()]);
        let mut radio = RadioFrame {
            transmission: radio_transmission_from_iracing(0, 0, 0),
            push_to_talk: false,
        };

        declared.mask_radio(&mut radio);

        assert_eq!(radio.transmission, None);
    }

    #[test]
    fn unknown_values_read_as_clear() {
        assert_eq!(spotter_from_iracing(-1), SpotterState::Clear);
        assert_eq!(spotter_from_iracing(99), SpotterState::Clear);
    }
}
