//! Reference lap processor — buffers speed/throttle/brake for the current lap,
//! bucketed by lap distance, and commits the buffer as the new reference lap
//! whenever `lap_best_lap_time` improves (i.e. the lap just completed was a
//! new personal best for this track+car).
use crate::capabilities::Capabilities;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use crate::model::reference_lap::{
    ReferenceLapData, ReferenceLapSample, REFERENCE_LAP_BUCKET_COUNT,
};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Above this `lap_dist_pct` we consider the car "near the finish line".
const WRAP_HIGH_THRESHOLD: f32 = 0.9;
/// Below this `lap_dist_pct` we consider the car "just past the finish line".
const WRAP_LOW_THRESHOLD: f32 = 0.1;
/// Guards against float-equality false negatives when comparing best lap times.
const BEST_TIME_EPSILON: f32 = 1e-4;

#[derive(Debug, Default)]
pub struct ReferenceLapProcessor {
    working: Vec<ReferenceLapSample>,
    prev_lap_dist_pct: f32,
    /// 0.0 = no best lap observed yet for the current track+car.
    prev_best_lap_time: f32,
    last_track_id: Option<i32>,
    last_car_screen_name: Option<String>,
    /// Last bucket written this lap — lets us forward-fill buckets skipped
    /// between ticks (e.g. high speed relative to bucket resolution) so they
    /// don't fall back to a default zero-speed sample.
    last_bucket: Option<usize>,
    /// Set when `lap_dist_pct` was invalid/missing mid-lap (e.g. a pit
    /// teleport) — the resulting position discontinuity can look like a
    /// finish-line crossing even though no real lap was driven, so the
    /// working buffer must not be committed as a new best.
    lap_invalidated: bool,
    /// Set by the delete_reference_lap command; consumed on the next tick so
    /// the in-memory best does not block re-recording after the stored
    /// reference file was deleted.
    reset_requested: Arc<AtomicBool>,
}

/// Average remaining tread (0.0-1.0, 1.0=fresh) across all sampled tire zones, when any are present.
fn average_tire_wear(chassis: &crate::model::player::ChassisFrame) -> Option<f32> {
    let readings = [
        chassis.lf_wear_l,
        chassis.lf_wear_m,
        chassis.lf_wear_r,
        chassis.rf_wear_l,
        chassis.rf_wear_m,
        chassis.rf_wear_r,
        chassis.lr_wear_l,
        chassis.lr_wear_m,
        chassis.lr_wear_r,
        chassis.rr_wear_l,
        chassis.rr_wear_m,
        chassis.rr_wear_r,
    ];

    let present: Vec<f32> = readings.into_iter().flatten().collect();

    if present.is_empty() {
        return None;
    }

    Some(present.iter().sum::<f32>() / present.len() as f32)
}

impl ReferenceLapProcessor {
    pub fn new(reset_requested: Arc<AtomicBool>) -> Self {
        Self {
            reset_requested,
            ..Self::default()
        }
    }

    fn ensure_working_buffer(&mut self) {
        if self.working.len() != REFERENCE_LAP_BUCKET_COUNT {
            self.working = vec![ReferenceLapSample::default(); REFERENCE_LAP_BUCKET_COUNT];
        }
    }

    fn reset_for_new_lap(&mut self) {
        if self.working.len() == REFERENCE_LAP_BUCKET_COUNT {
            self.working.fill(ReferenceLapSample::default());
        } else {
            self.working = vec![ReferenceLapSample::default(); REFERENCE_LAP_BUCKET_COUNT];
        }

        self.last_bucket = None;
        self.lap_invalidated = false;
    }

    fn reset_for_new_identity(&mut self) {
        self.reset_for_new_lap();
        self.prev_best_lap_time = 0.0;
        self.prev_lap_dist_pct = -1.0;
    }
}

impl Processor for ReferenceLapProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::ReferenceLap
    }

    fn required(&self) -> Capabilities {
        Capabilities::empty()
    }

    fn rate(&self) -> TickRate {
        TickRate::Hz60
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        self.ensure_working_buffer();

        if self.reset_requested.swap(false, Ordering::Relaxed) {
            self.reset_for_new_identity();
        }

        let track_id = ctx.session.track_id;
        let player_idx = ctx.session.player_car_idx;
        let car_screen_name = ctx
            .session
            .cars
            .iter()
            .find(|car| car.car_idx == player_idx)
            .map(|car| car.car_screen_name.clone())
            .unwrap_or_default();

        if self.last_track_id != Some(track_id)
            || self.last_car_screen_name.as_deref() != Some(car_screen_name.as_str())
        {
            self.last_track_id = Some(track_id);
            self.last_car_screen_name = Some(car_screen_name.clone());
            self.reset_for_new_identity();
        }

        let lap_dist_pct = match ctx.lap_timing.lap_dist_pct {
            Some(pct) if pct >= 0.0 => pct,
            _ => {
                self.lap_invalidated = true;
                return None;
            }
        };

        let bucket = ((lap_dist_pct * REFERENCE_LAP_BUCKET_COUNT as f32) as usize)
            .min(REFERENCE_LAP_BUCKET_COUNT - 1);

        let sample = ReferenceLapSample {
            speed: ctx.car_dynamics.speed,
            throttle: ctx.car_inputs.throttle,
            brake: ctx.car_inputs.brake,
            lat_accel: ctx.car_dynamics.lat_accel,
            steering_wheel_angle: ctx.car_dynamics.steering_wheel_angle,
        };

        if let Some(last) = self.last_bucket {
            if bucket > last + 1 {
                for skipped in (last + 1)..bucket {
                    self.working[skipped] = sample;
                }
            }
        }

        self.working[bucket] = sample;
        self.last_bucket = Some(bucket);

        let crossed_finish_line =
            self.prev_lap_dist_pct > WRAP_HIGH_THRESHOLD && lap_dist_pct < WRAP_LOW_THRESHOLD;
        self.prev_lap_dist_pct = lap_dist_pct;

        if !crossed_finish_line {
            return None;
        }

        let best_lap_time = ctx.lap_timing.lap_best_lap_time.unwrap_or(0.0);
        let is_new_best = !self.lap_invalidated
            && best_lap_time > 0.0
            && (self.prev_best_lap_time <= 0.0
                || best_lap_time < self.prev_best_lap_time - BEST_TIME_EPSILON);

        self.prev_best_lap_time = best_lap_time;

        let output = if is_new_best {
            Some(ComputedOutput::ReferenceLap(ReferenceLapData {
                track_id,
                car_screen_name,
                lap_time: best_lap_time,
                samples: self.working.clone(),
                recorded_wetness: ctx.environment.track_wetness.map(|wetness| wetness as f32),
                recorded_tire_wear: average_tire_wear(ctx.chassis),
                recorded_fuel_level: Some(ctx.car_status.fuel_level),
            }))
        } else {
            None
        };

        self.reset_for_new_lap();

        output
    }

    fn reset(&mut self) {
        self.reset_for_new_identity();
        self.last_track_id = None;
        self.last_car_screen_name = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::cars::CarIdxFrame;
    use crate::model::player::{CarDynamicsFrame, CarInputsFrame, CarStatusFrame, LapTimingFrame};
    use crate::model::session::{CarEntry, SessionSnapshot};
    use std::collections::HashMap;

    fn make_dynamics(speed: f32) -> CarDynamicsFrame {
        CarDynamicsFrame {
            speed,
            rpm: 3000.0,
            gear: 3,
            steering_wheel_angle: 0.0,
            velocity_x: None,
            velocity_y: None,
            velocity_z: None,
            lat_accel: None,
            long_accel: None,
            yaw: None,
            yaw_rate: None,
            pitch: None,
            roll: None,
            shift_indicator_pct: None,
            shift_grind_rpm: None,
        }
    }

    fn make_inputs(throttle: f32, brake: f32) -> CarInputsFrame {
        CarInputsFrame {
            throttle,
            brake,
            clutch: None,
            brake_abs_active: false,
        }
    }

    fn make_lap_timing(lap_dist_pct: f32, best_lap_time: Option<f32>) -> LapTimingFrame {
        LapTimingFrame {
            lap: None,
            lap_dist: None,
            lap_dist_pct: Some(lap_dist_pct),
            lap_current_lap_time: 0.0,
            lap_last_lap_time: None,
            lap_best_lap_time: best_lap_time,
            player_car_position: None,
            player_car_class_position: None,
            lap_delta_to_session_best_live: None,
            lap_delta_to_session_optimal_live: None,
            lap_delta_to_driver_best_live: None,
            lap_delta_to_best_lap: None,
            lap_delta_to_best_lap_dd: None,
            lap_delta_to_best_lap_ok: None,
            lap_delta_to_optimal_lap: None,
            lap_delta_to_optimal_lap_dd: None,
            lap_delta_to_optimal_lap_ok: None,
            lap_delta_to_session_best_lap: None,
            lap_delta_to_session_best_lap_dd: None,
            lap_delta_to_session_best_lap_ok: None,
            lap_delta_to_session_lastl_lap: None,
            lap_delta_to_session_lastl_lap_dd: None,
            lap_delta_to_session_lastl_lap_ok: None,
            lap_delta_to_session_optimal_lap: None,
            lap_delta_to_session_optimal_lap_dd: None,
            lap_delta_to_session_optimal_lap_ok: None,
        }
    }

    fn make_car_status() -> CarStatusFrame {
        CarStatusFrame {
            fuel_level: 0.0,
            fuel_level_pct: None,
            fuel_use_per_hour: None,
            oil_temp: None,
            oil_press: None,
            water_temp: None,
            voltage: None,
            on_pit_road: Some(false),
            is_on_track: None,
            car_left_right: None,
            engine_warnings: None,
            player_car_sl_shift_rpm: vec![],
            player_car_sl_blink_rpm: vec![],
            flags: crate::model::flags::RaceFlags::default(),
            dc_abs: None,
            dc_brake_bias: None,
            dc_traction_control: None,
            dc_throttle_shape: None,
        }
    }

    fn make_car_idx() -> CarIdxFrame {
        CarIdxFrame {
            car_idx_lap_dist_pct: vec![],
            car_idx_on_pit_road: vec![],
            car_idx_position: vec![],
            car_idx_class_position: vec![],
            car_idx_lap: vec![],
            car_idx_last_lap_time: vec![],
            car_idx_best_lap_time: vec![],
            car_idx_f2_time: vec![],
            car_idx_est_time: vec![],
            car_idx_track_surface: vec![],
            car_idx_tire_compound: vec![],
            car_idx_session_flags: vec![],
            car_left_right: None,
        }
    }

    fn make_session(track_id: i32) -> SessionSnapshot {
        SessionSnapshot {
            track_id,
            player_car_idx: 0,
            cars: vec![CarEntry {
                car_idx: 0,
                car_screen_name: "Test Car".to_string(),
                ..CarEntry::default()
            }],
            ..SessionSnapshot::default()
        }
    }

    struct MakeCtxArgs<'a> {
        dynamics: &'a CarDynamicsFrame,
        inputs: &'a CarInputsFrame,
        lap_timing: &'a LapTimingFrame,
        car_status: &'a CarStatusFrame,
        session: &'a SessionSnapshot,
        car_idx: &'a CarIdxFrame,
        start_positions: &'a HashMap<i32, (i32, i32)>,
        chassis: &'a crate::model::player::ChassisFrame,
        environment: &'a crate::model::environment::EnvironmentFrame,
    }

    fn make_ctx(args: MakeCtxArgs) -> ComputeContext {
        ComputeContext {
            car_dynamics: args.dynamics,
            car_inputs: args.inputs,
            car_idx: args.car_idx,
            lap_timing: args.lap_timing,
            car_status: args.car_status,
            chassis: args.chassis,
            environment: args.environment,
            session: args.session,
            track_length_m: 3700.0,
            car_length_m: 4.4,
            start_positions: args.start_positions,
            pit_warning_laps: 2.0,
            lap_delta_active: false,
            session_num: Some(0),
            session_time_remain: None,
        }
    }

    #[test]
    fn first_valid_lap_is_committed_as_best() {
        let mut proc = ReferenceLapProcessor::default();
        let session = make_session(1);
        let car_status = make_car_status();
        let car_idx = make_car_idx();
        let start_pos = HashMap::new();
        let chassis = crate::model::player::ChassisFrame::default();
        let environment = crate::model::environment::EnvironmentFrame::default();

        // Drive through the lap, sampling a couple of points.
        for pct in [0.1_f32, 0.5, 0.95] {
            let dynamics = make_dynamics(50.0);
            let inputs = make_inputs(1.0, 0.0);
            let lap_timing = make_lap_timing(pct, None);
            let ctx = make_ctx(MakeCtxArgs {
                dynamics: &dynamics,
                inputs: &inputs,
                lap_timing: &lap_timing,
                car_status: &car_status,
                session: &session,
                car_idx: &car_idx,
                start_positions: &start_pos,
                chassis: &chassis,
                environment: &environment,
            });
            assert!(proc.compute(&ctx).is_none());
        }

        // Cross the finish line with a freshly-set best lap time.
        let dynamics = make_dynamics(50.0);
        let inputs = make_inputs(1.0, 0.0);
        let lap_timing = make_lap_timing(0.05, Some(90.0));
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        let output = proc.compute(&ctx);

        match output {
            Some(ComputedOutput::ReferenceLap(data)) => {
                assert_eq!(data.track_id, 1);
                assert_eq!(data.car_screen_name, "Test Car");
                assert_eq!(data.lap_time, 90.0);
                let bucket_at_50pct = data.samples[500];
                assert_eq!(bucket_at_50pct.speed, 50.0);
            }
            other => panic!("expected ReferenceLap output, got {other:?}"),
        }
    }

    #[test]
    fn commits_recorded_conditions_from_the_committing_tick() {
        let mut proc = ReferenceLapProcessor::default();
        let session = make_session(1);
        let mut car_status = make_car_status();
        car_status.fuel_level = 42.0;
        let car_idx = make_car_idx();
        let start_pos = HashMap::new();
        let chassis = crate::model::player::ChassisFrame {
            lf_wear_l: Some(0.9),
            rf_wear_l: Some(0.7),
            ..Default::default()
        };
        let environment = crate::model::environment::EnvironmentFrame {
            track_wetness: Some(3),
            ..Default::default()
        };

        let dynamics = make_dynamics(50.0);
        let inputs = make_inputs(1.0, 0.0);
        let lap_timing = make_lap_timing(0.95, None);
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        let _ = proc.compute(&ctx);

        let lap_timing = make_lap_timing(0.05, Some(90.0));
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        let output = proc.compute(&ctx);

        match output {
            Some(ComputedOutput::ReferenceLap(data)) => {
                assert_eq!(data.recorded_wetness, Some(3.0));
                assert!((data.recorded_tire_wear.unwrap() - 0.8).abs() < 1e-4);
                assert_eq!(data.recorded_fuel_level, Some(42.0));
            }
            other => panic!("expected ReferenceLap output, got {other:?}"),
        }
    }

    #[test]
    fn slower_lap_does_not_overwrite_reference() {
        let mut proc = ReferenceLapProcessor::default();
        let session = make_session(1);
        let car_status = make_car_status();
        let car_idx = make_car_idx();
        let start_pos = HashMap::new();
        let chassis = crate::model::player::ChassisFrame::default();
        let environment = crate::model::environment::EnvironmentFrame::default();

        let dynamics = make_dynamics(50.0);
        let inputs = make_inputs(1.0, 0.0);

        // First lap sets the best.
        let lap_timing = make_lap_timing(0.5, None);
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        let _ = proc.compute(&ctx);
        let lap_timing = make_lap_timing(0.95, None);
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        let _ = proc.compute(&ctx);
        let lap_timing = make_lap_timing(0.05, Some(90.0));
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        assert!(proc.compute(&ctx).is_some());

        // Second lap is slower — best lap time is unchanged.
        let lap_timing = make_lap_timing(0.5, Some(90.0));
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        let _ = proc.compute(&ctx);
        let lap_timing = make_lap_timing(0.95, None);
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        let _ = proc.compute(&ctx);
        let lap_timing = make_lap_timing(0.05, Some(90.0));
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        assert!(proc.compute(&ctx).is_none());
    }

    #[test]
    fn track_change_resets_prior_best() {
        let mut proc = ReferenceLapProcessor::default();
        let car_status = make_car_status();
        let car_idx = make_car_idx();
        let start_pos = HashMap::new();
        let chassis = crate::model::player::ChassisFrame::default();
        let environment = crate::model::environment::EnvironmentFrame::default();
        let dynamics = make_dynamics(50.0);
        let inputs = make_inputs(1.0, 0.0);

        let session1 = make_session(1);
        let lap_timing = make_lap_timing(0.5, None);
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session1,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        let _ = proc.compute(&ctx);
        let lap_timing = make_lap_timing(0.95, None);
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session1,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        let _ = proc.compute(&ctx);
        let lap_timing = make_lap_timing(0.05, Some(90.0));
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session1,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        assert!(proc.compute(&ctx).is_some());

        // Switch tracks — a slower time than the old best should still count as new best.
        let session2 = make_session(2);
        let lap_timing = make_lap_timing(0.5, None);
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session2,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        let _ = proc.compute(&ctx);
        let lap_timing = make_lap_timing(0.95, None);
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session2,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        let _ = proc.compute(&ctx);
        let lap_timing = make_lap_timing(0.05, Some(95.0));
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session: &session2,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment: &environment,
        });
        assert!(proc.compute(&ctx).is_some());
    }
}
