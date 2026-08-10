//! Reference lap processor — buffers speed/throttle/brake for the current lap,
//! bucketed by lap distance, and commits the buffer as the new reference lap
//! whenever the completed lap beats the one already persisted on disk *for the
//! track condition it was driven in*.
//!
//! Dry and wet are kept as separate references: a dry lap is not a usable target
//! in the rain, and a wet lap can never approach the dry time, so one stored
//! best would leave the driver without a reference the moment it rained.
//! Comparing per condition also keeps a fresh session's best from degrading a
//! faster stored reference.
use crate::capabilities::Capabilities;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use crate::model::reference_lap::{
    ReferenceLapData, ReferenceLapSample, StoredReferenceTimes, TrackCondition,
    REFERENCE_LAP_BUCKET_COUNT,
};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

/// Above this `lap_dist_pct` we consider the car "near the finish line".
const WRAP_HIGH_THRESHOLD: f32 = 0.9;
/// Below this `lap_dist_pct` we consider the car "just past the finish line".
const WRAP_LOW_THRESHOLD: f32 = 0.1;
/// Guards against float-equality false negatives when comparing best lap times.
const BEST_TIME_EPSILON: f32 = 1e-4;
/// Minimum allowed `lap_dist_pct` advance between two ticks before the jump is
/// treated as a teleport. Even at 150 m/s on a 1 km track a 60 Hz tick covers
/// 150/60/1000 = 0.0025 of the lap; a larger jump (in either direction,
/// outside the finish-line wrap) means the car was teleported (pit tow,
/// session reset) — the working buffer then holds forward-filled garbage and
/// must not be committed as a reference lap.
const MAX_TICK_DIST_PCT_JUMP: f32 = 0.01;
/// Lag-spike budget (s): frame drops / CPU stalls make consecutive processed
/// ticks arbitrarily far apart in time, so the allowed jump also scales with
/// the distance the car could genuinely cover at its current speed within this
/// budget. A pit teleport lands the car at ~0 speed, so the speed-scaled
/// allowance collapses back to the floor and real teleports are still caught.
const MAX_LAG_SPIKE_S: f32 = 1.5;
/// How long a completed lap waits for the sim to publish its time before it is
/// dropped. Two seconds at 60 Hz — far beyond the frame or two iRacing actually
/// takes, and short enough that a dropped lap is the one just driven.
const MAX_PENDING_TICKS: u32 = 120;
/// Lap-fraction band in which `lap_last_lap_time` is sampled as the "previous
/// lap" baseline. Anywhere in the middle of the lap the sim cannot yet be
/// publishing the lap in progress, so the value read there is unambiguously the
/// one the completed lap has to differ from — see `PendingLap`.
const BASELINE_SAMPLE_LOW: f32 = 0.3;
const BASELINE_SAMPLE_HIGH: f32 = 0.7;

#[derive(Debug, Default)]
pub struct ReferenceLapProcessor {
    working: Vec<ReferenceLapSample>,
    prev_lap_dist_pct: f32,
    /// Highest wetness seen anywhere on the lap in progress. A lap that was
    /// rained on part-way through is a wet lap: its fast line is the wet one
    /// from that point, and filing it as dry would poison the dry reference.
    lap_max_wetness: Option<i32>,
    /// A completed lap held back until the sim publishes its time — see
    /// `PendingLap`.
    pending: Option<PendingLap>,
    /// `lap_last_lap_time` as it read in the middle of the lap in progress —
    /// the previous lap's time, whatever the sim does at the crossing.
    mid_lap_last_lap_time: Option<f32>,
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
    /// Lap times of the references persisted on disk for the current track+car,
    /// one per condition (refreshed by the telemetry runtime on session-info
    /// updates). A lap is committed only when it beats the stored time *for its
    /// own condition* — which is also what lets a wet lap be recorded at all,
    /// since it will never approach the dry time.
    stored_best_lap_time: Arc<Mutex<StoredReferenceTimes>>,
}

/// A lap that has crossed the line but whose time the sim has not published yet.
///
/// `lap_last_lap_time` is not reliable on the crossing tick itself — iRacing
/// sometimes updates it a frame before the lap counter and sometimes a few
/// frames after — so the completed buffer is parked here and committed once the
/// value differs from the previous lap's.
///
/// The baseline it is compared against is sampled in the *middle* of the lap,
/// not on the crossing tick: when the sim publishes the time early, the crossing
/// tick already reads the completed lap's own time, and a baseline taken there
/// can never differ from it — the lap would then wait out `MAX_PENDING_TICKS`
/// and be dropped, silently losing a genuine personal best.
#[derive(Debug)]
struct PendingLap {
    samples: Vec<ReferenceLapSample>,
    condition: TrackCondition,
    recorded_wetness: Option<f32>,
    recorded_tire_wear: Option<f32>,
    recorded_fuel_level: Option<f32>,
    /// The previous lap's `lap_last_lap_time`, sampled mid-lap where available.
    baseline_last_lap_time: Option<f32>,
    ticks_waited: u32,
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
    pub fn new(
        reset_requested: Arc<AtomicBool>,
        stored_best_lap_time: Arc<Mutex<StoredReferenceTimes>>,
    ) -> Self {
        Self {
            reset_requested,
            stored_best_lap_time,
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
        self.lap_max_wetness = None;
        self.mid_lap_last_lap_time = None;
    }

    fn reset_for_new_identity(&mut self) {
        self.reset_for_new_lap();
        self.pending = None;
        self.prev_lap_dist_pct = -1.0;
    }

    /// Commits the parked lap once the sim publishes its time, or drops it if
    /// that never happens. Returns the reference lap only when the completed
    /// lap actually beats the stored one for its own condition.
    fn resolve_pending(
        &mut self,
        ctx: &ComputeContext,
        track_id: i32,
        car_screen_name: String,
    ) -> Option<ComputedOutput> {
        let pending = self.pending.as_mut()?;

        pending.ticks_waited += 1;

        let lap_time = ctx.lap_timing.lap_last_lap_time.filter(|time| *time > 0.0);
        let settled = lap_time.is_some_and(|time| {
            pending
                .baseline_last_lap_time
                .is_none_or(|before| (time - before).abs() > BEST_TIME_EPSILON)
        });

        if !settled {
            if pending.ticks_waited >= MAX_PENDING_TICKS {
                self.pending = None;
            }

            return None;
        }

        let pending = self.pending.take()?;
        let lap_time = lap_time?;

        let stored_time = self
            .stored_best_lap_time
            .lock()
            .ok()
            .and_then(|stored| stored.get(pending.condition));
        let beats_stored =
            stored_time.is_none_or(|stored| stored <= 0.0 || lap_time < stored - BEST_TIME_EPSILON);

        if !beats_stored {
            return None;
        }

        if let Ok(mut stored) = self.stored_best_lap_time.lock() {
            stored.set(pending.condition, Some(lap_time));
        }

        Some(ComputedOutput::ReferenceLap(ReferenceLapData {
            track_id,
            car_screen_name,
            lap_time,
            samples: pending.samples,
            condition: pending.condition,
            recorded_wetness: pending.recorded_wetness,
            recorded_tire_wear: pending.recorded_tire_wear,
            recorded_fuel_level: pending.recorded_fuel_level,
        }))
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

        // A pit teleport keeps `lap_dist_pct` valid but makes it jump. Detect
        // any discontinuity that is not the finish-line wrap and invalidate the
        // lap: the forward-fill below would otherwise smear a single stationary
        // pit-stall sample (speed ~0) across every skipped bucket, and a later
        // commit would bake those zeros into the reference lap.
        if self.prev_lap_dist_pct >= 0.0 {
            let delta = lap_dist_pct - self.prev_lap_dist_pct;
            let is_finish_wrap =
                self.prev_lap_dist_pct > WRAP_HIGH_THRESHOLD && lap_dist_pct < WRAP_LOW_THRESHOLD;

            let lag_travel_pct = if ctx.track_length_m > 0.0 {
                (ctx.car_dynamics.speed * MAX_LAG_SPIKE_S) / ctx.track_length_m
            } else {
                0.0
            };
            let max_allowed_jump = lag_travel_pct.max(MAX_TICK_DIST_PCT_JUMP);

            if delta.abs() > max_allowed_jump && !is_finish_wrap {
                self.lap_invalidated = true;
            }
        }

        let bucket = ((lap_dist_pct * REFERENCE_LAP_BUCKET_COUNT as f32) as usize)
            .min(REFERENCE_LAP_BUCKET_COUNT - 1);

        let sample = ReferenceLapSample {
            speed: ctx.car_dynamics.speed,
            throttle: ctx.car_inputs.throttle,
            brake: ctx.car_inputs.brake,
            lat_accel: ctx.car_dynamics.lat_accel,
            long_accel: ctx.car_dynamics.long_accel,
            steering_wheel_angle: ctx.car_dynamics.steering_wheel_angle,
        };

        // The crossing is settled *before* this tick's sample is filed: the tick
        // that wraps past the line already belongs to the new lap, so writing it
        // into the working buffer first would hand the completed lap a bucket of
        // the next one's data.
        let crossed_finish_line =
            self.prev_lap_dist_pct > WRAP_HIGH_THRESHOLD && lap_dist_pct < WRAP_LOW_THRESHOLD;
        self.prev_lap_dist_pct = lap_dist_pct;

        if crossed_finish_line {
            // A lap that could not be timed is dropped rather than queued, and
            // a still-unresolved previous lap is replaced: only the lap just
            // driven can be the one the sim is about to publish a time for.
            self.pending = (!self.lap_invalidated).then(|| PendingLap {
                samples: self.working.clone(),
                condition: TrackCondition::from_wetness(self.lap_max_wetness),
                recorded_wetness: self.lap_max_wetness.map(|wetness| wetness as f32),
                recorded_tire_wear: average_tire_wear(ctx.chassis),
                recorded_fuel_level: Some(ctx.car_status.fuel_level),
                // Mid-lap when the lap got that far; the crossing tick is the
                // fallback for a lap joined past the sampling band.
                baseline_last_lap_time: self
                    .mid_lap_last_lap_time
                    .or(ctx.lap_timing.lap_last_lap_time),
                ticks_waited: 0,
            });

            self.reset_for_new_lap();
        }

        if let Some(last) = self.last_bucket {
            if bucket > last + 1 {
                for skipped in (last + 1)..bucket {
                    self.working[skipped] = sample;
                }
            }
        }

        self.working[bucket] = sample;
        self.last_bucket = Some(bucket);

        if (BASELINE_SAMPLE_LOW..BASELINE_SAMPLE_HIGH).contains(&lap_dist_pct) {
            if let Some(previous_lap_time) = ctx.lap_timing.lap_last_lap_time {
                self.mid_lap_last_lap_time = Some(previous_lap_time);
            }
        }

        if let Some(wetness) = ctx.environment.track_wetness {
            self.lap_max_wetness = Some(
                self.lap_max_wetness
                    .map_or(wetness, |peak| peak.max(wetness)),
            );
        }

        self.resolve_pending(ctx, track_id, car_screen_name)
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

    fn make_lap_timing(lap_dist_pct: f32, last_lap_time: Option<f32>) -> LapTimingFrame {
        LapTimingFrame {
            lap: None,
            lap_dist: None,
            lap_dist_pct: Some(lap_dist_pct),
            lap_current_lap_time: 0.0,
            lap_last_lap_time: last_lap_time,
            lap_best_lap_time: None,
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

    /// Advance the processor by one tick at `lap_dist_pct` with default frames.
    fn run_tick(
        proc: &mut ReferenceLapProcessor,
        session: &SessionSnapshot,
        lap_dist_pct: f32,
        last_lap_time: Option<f32>,
    ) -> Option<ComputedOutput> {
        run_tick_in(
            proc,
            session,
            lap_dist_pct,
            last_lap_time,
            &crate::model::environment::EnvironmentFrame::default(),
        )
    }

    fn run_tick_in(
        proc: &mut ReferenceLapProcessor,
        session: &SessionSnapshot,
        lap_dist_pct: f32,
        last_lap_time: Option<f32>,
        environment: &crate::model::environment::EnvironmentFrame,
    ) -> Option<ComputedOutput> {
        run_tick_at_speed(
            proc,
            session,
            lap_dist_pct,
            last_lap_time,
            environment,
            50.0,
        )
    }

    fn run_tick_at_speed(
        proc: &mut ReferenceLapProcessor,
        session: &SessionSnapshot,
        lap_dist_pct: f32,
        last_lap_time: Option<f32>,
        environment: &crate::model::environment::EnvironmentFrame,
        speed: f32,
    ) -> Option<ComputedOutput> {
        let dynamics = make_dynamics(speed);
        let inputs = make_inputs(1.0, 0.0);
        let lap_timing = make_lap_timing(lap_dist_pct, last_lap_time);
        let car_status = make_car_status();
        let car_idx = make_car_idx();
        let start_pos = HashMap::new();
        let chassis = crate::model::player::ChassisFrame::default();
        let ctx = make_ctx(MakeCtxArgs {
            dynamics: &dynamics,
            inputs: &inputs,
            lap_timing: &lap_timing,
            car_status: &car_status,
            session,
            car_idx: &car_idx,
            start_positions: &start_pos,
            chassis: &chassis,
            environment,
        });
        proc.compute(&ctx)
    }

    /// Crosses the finish line and then runs the tick on which the sim
    /// publishes the completed lap's time, which is when the processor decides.
    fn cross_line(
        proc: &mut ReferenceLapProcessor,
        session: &SessionSnapshot,
        lap_time: f32,
    ) -> Option<ComputedOutput> {
        cross_line_in(
            proc,
            session,
            lap_time,
            &crate::model::environment::EnvironmentFrame::default(),
        )
    }

    fn cross_line_in(
        proc: &mut ReferenceLapProcessor,
        session: &SessionSnapshot,
        lap_time: f32,
        environment: &crate::model::environment::EnvironmentFrame,
    ) -> Option<ComputedOutput> {
        assert!(run_tick_in(proc, session, 0.05, None, environment).is_none());

        run_tick_in(proc, session, 0.055, Some(lap_time), environment)
    }

    /// Drive `from..to` in steps small enough to stay under the teleport
    /// detection threshold, as a real 60 Hz feed would.
    fn drive_segment(
        proc: &mut ReferenceLapProcessor,
        session: &SessionSnapshot,
        from_pct: f32,
        to_pct: f32,
    ) {
        let mut pct = from_pct;
        while pct < to_pct {
            assert!(run_tick(proc, session, pct, None).is_none());
            pct += 0.005;
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
            fuel_settings: crate::computations::fuel::FuelSettings::default(),
            lap_delta_active: false,
            session_num: Some(0),
            session_time_remain: None,
            session_state: None,
        }
    }

    #[test]
    fn first_valid_lap_is_committed_as_best() {
        let mut proc = ReferenceLapProcessor::default();
        let session = make_session(1);

        drive_segment(&mut proc, &session, 0.005, 0.995);

        // Cross the finish line; the sim publishes the time a tick later.
        let output = cross_line(&mut proc, &session, 90.0);

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

    /// The tick that wraps past the line is the new lap's first sample. It must
    /// not land in the buffer that is being handed over as the completed lap.
    #[test]
    fn the_wrapping_tick_does_not_leak_into_the_completed_lap() {
        let mut proc = ReferenceLapProcessor::default();
        let session = make_session(1);
        let dry = crate::model::environment::EnvironmentFrame::default();

        drive_segment(&mut proc, &session, 0.005, 0.995);

        // The new lap starts at a distinctly different speed than the one just
        // driven, so a leaked sample is visible in its bucket.
        assert!(run_tick_at_speed(&mut proc, &session, 0.001, None, &dry, 200.0).is_none());

        match run_tick_at_speed(&mut proc, &session, 0.005, Some(90.0), &dry, 200.0) {
            Some(ComputedOutput::ReferenceLap(data)) => {
                assert_eq!(data.samples[1].speed, 0.0);
                assert_eq!(data.samples[500].speed, 50.0);
            }
            other => panic!("expected ReferenceLap output, got {other:?}"),
        }
    }

    #[test]
    fn pit_teleport_jump_invalidates_the_lap() {
        let mut proc = ReferenceLapProcessor::default();
        let session = make_session(1);

        // Mid-lap teleport: lap_dist_pct stays valid but jumps 0.4 → 0.85.
        drive_segment(&mut proc, &session, 0.005, 0.4);
        assert!(run_tick(&mut proc, &session, 0.85, None).is_none());
        drive_segment(&mut proc, &session, 0.855, 0.995);

        // Crossing must NOT commit the teleport-tainted buffer.
        assert!(cross_line(&mut proc, &session, 90.0).is_none());

        // The next cleanly driven lap commits again.
        drive_segment(&mut proc, &session, 0.06, 0.995);
        assert!(cross_line(&mut proc, &session, 89.0).is_some());
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

        // Crossing the line parks the lap; the sim publishes its time next tick.
        let lap_timing = make_lap_timing(0.05, None);
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

        let lap_timing = make_lap_timing(0.055, Some(90.0));
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
                // Wetness 3 is past the wet threshold, so this is a wet reference.
                assert_eq!(data.condition, TrackCondition::Wet);
                assert!((data.recorded_tire_wear.unwrap() - 0.8).abs() < 1e-4);
                assert_eq!(data.recorded_fuel_level, Some(42.0));
            }
            other => panic!("expected ReferenceLap output, got {other:?}"),
        }
    }

    #[test]
    fn wet_lap_is_stored_against_the_wet_reference_not_the_dry_one() {
        let stored = Arc::new(Mutex::new(StoredReferenceTimes {
            dry: Some(85.0),
            wet: None,
        }));
        let mut proc =
            ReferenceLapProcessor::new(Arc::new(AtomicBool::new(false)), Arc::clone(&stored));
        let session = make_session(1);
        let wet = crate::model::environment::EnvironmentFrame {
            track_wetness: Some(5),
            ..Default::default()
        };

        // Nowhere near the 85 s dry reference, but it is the first wet lap —
        // which is exactly the case a single stored best could never record.
        let mut pct = 0.005;
        while pct < 0.995 {
            assert!(run_tick_in(&mut proc, &session, pct, None, &wet).is_none());
            pct += 0.005;
        }

        match cross_line_in(&mut proc, &session, 110.0, &wet) {
            Some(ComputedOutput::ReferenceLap(data)) => {
                assert_eq!(data.condition, TrackCondition::Wet);
                assert_eq!(data.lap_time, 110.0);
            }
            other => panic!("expected a wet ReferenceLap, got {other:?}"),
        }

        let times = *stored.lock().unwrap();
        assert_eq!(times.wet, Some(110.0));
        // The dry reference must be left exactly as it was.
        assert_eq!(times.dry, Some(85.0));
    }

    #[test]
    fn a_lap_rained_on_part_way_through_counts_as_wet() {
        let mut proc = ReferenceLapProcessor::default();
        let session = make_session(1);
        let dry = crate::model::environment::EnvironmentFrame::default();
        let wet = crate::model::environment::EnvironmentFrame {
            track_wetness: Some(4),
            ..Default::default()
        };

        let mut pct = 0.005;
        while pct < 0.5 {
            assert!(run_tick_in(&mut proc, &session, pct, None, &dry).is_none());
            pct += 0.005;
        }
        while pct < 0.995 {
            assert!(run_tick_in(&mut proc, &session, pct, None, &wet).is_none());
            pct += 0.005;
        }

        match cross_line_in(&mut proc, &session, 105.0, &wet) {
            Some(ComputedOutput::ReferenceLap(data)) => {
                assert_eq!(data.condition, TrackCondition::Wet);
            }
            other => panic!("expected a wet ReferenceLap, got {other:?}"),
        }
    }

    /// iRacing sometimes publishes the completed lap's time a frame *before* the
    /// position wraps. The crossing tick then already reads the new time and it
    /// never changes again — a baseline taken there would wait forever and drop
    /// a genuine personal best.
    #[test]
    fn a_lap_timed_before_the_line_is_still_committed() {
        let stored = Arc::new(Mutex::new(StoredReferenceTimes {
            dry: Some(95.0),
            wet: None,
        }));
        let mut proc =
            ReferenceLapProcessor::new(Arc::new(AtomicBool::new(false)), Arc::clone(&stored));
        let session = make_session(1);

        // Through the lap the sim reports the previous lap's time.
        let mut pct = 0.005;
        while pct < 0.995 {
            assert!(run_tick(&mut proc, &session, pct, Some(95.0)).is_none());
            pct += 0.005;
        }

        // The new time lands one tick early and then stays put.
        assert!(run_tick(&mut proc, &session, 0.998, Some(90.0)).is_none());

        match run_tick(&mut proc, &session, 0.05, Some(90.0)) {
            Some(ComputedOutput::ReferenceLap(data)) => assert_eq!(data.lap_time, 90.0),
            other => panic!("expected ReferenceLap output, got {other:?}"),
        }

        assert_eq!(stored.lock().unwrap().dry, Some(90.0));
    }

    #[test]
    fn a_lap_the_sim_never_times_is_dropped() {
        let mut proc = ReferenceLapProcessor::default();
        let session = make_session(1);

        drive_segment(&mut proc, &session, 0.005, 0.995);
        assert!(run_tick(&mut proc, &session, 0.05, None).is_none());

        // The time never arrives; the parked lap must not linger and commit
        // itself against some later lap's time.
        for _ in 0..MAX_PENDING_TICKS {
            assert!(run_tick(&mut proc, &session, 0.055, None).is_none());
        }

        assert!(run_tick(&mut proc, &session, 0.06, Some(90.0)).is_none());
    }

    #[test]
    fn slower_lap_does_not_overwrite_reference() {
        let mut proc = ReferenceLapProcessor::default();
        let session = make_session(1);

        // First lap sets the best.
        drive_segment(&mut proc, &session, 0.005, 0.995);
        assert!(cross_line(&mut proc, &session, 90.0).is_some());

        // Second lap is slower — the stored reference stands.
        drive_segment(&mut proc, &session, 0.06, 0.995);
        assert!(cross_line(&mut proc, &session, 91.0).is_none());
    }

    #[test]
    fn session_best_slower_than_stored_reference_is_not_committed() {
        let stored = Arc::new(Mutex::new(StoredReferenceTimes {
            dry: Some(85.0),
            wet: None,
        }));
        let mut proc =
            ReferenceLapProcessor::new(Arc::new(AtomicBool::new(false)), Arc::clone(&stored));
        let session = make_session(1);

        // First lap (90.0) is slower than the persisted reference (85.0).
        drive_segment(&mut proc, &session, 0.005, 0.995);
        assert!(cross_line(&mut proc, &session, 90.0).is_none());

        // A lap faster than the stored reference commits and updates the shared time.
        drive_segment(&mut proc, &session, 0.06, 0.995);
        assert!(cross_line(&mut proc, &session, 84.0).is_some());
        assert_eq!(stored.lock().unwrap().dry, Some(84.0));
    }

    #[test]
    fn cleared_stored_reference_allows_recommit() {
        let stored = Arc::new(Mutex::new(StoredReferenceTimes::default()));
        let mut proc =
            ReferenceLapProcessor::new(Arc::new(AtomicBool::new(false)), Arc::clone(&stored));
        let session = make_session(1);

        drive_segment(&mut proc, &session, 0.005, 0.995);
        assert!(cross_line(&mut proc, &session, 90.0).is_some());
        assert_eq!(stored.lock().unwrap().dry, Some(90.0));
    }

    #[test]
    fn track_change_resets_prior_best() {
        let stored = Arc::new(Mutex::new(StoredReferenceTimes::default()));
        let mut proc =
            ReferenceLapProcessor::new(Arc::new(AtomicBool::new(false)), Arc::clone(&stored));

        let session1 = make_session(1);
        drive_segment(&mut proc, &session1, 0.005, 0.995);
        assert!(cross_line(&mut proc, &session1, 90.0).is_some());

        // Switch tracks — a slower time than the old best should still count as
        // new best. The runtime refreshes the shared stored time on the
        // session-info update that changes the track; mimic finding no file.
        *stored.lock().unwrap() = StoredReferenceTimes::default();
        let session2 = make_session(2);
        drive_segment(&mut proc, &session2, 0.005, 0.995);
        assert!(cross_line(&mut proc, &session2, 95.0).is_some());
    }
}
