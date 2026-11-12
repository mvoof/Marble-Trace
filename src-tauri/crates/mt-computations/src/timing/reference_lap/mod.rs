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
use crate::timing::lap_time_settle::is_settled_for_reference;
use crate::{ComputeContext, ComputedOutput, Processor, ProcessorCommand, ProcessorId, TickRate};
use mt_model::computed::reference_lap::{
    ReferenceLapData, ReferenceLapSample, StoredReferenceTimes, TrackCondition,
    REFERENCE_LAP_BUCKET_COUNT,
};
use mt_model::contract::capabilities::Capabilities;
use mt_model::sim::player::ChassisFrame;
use tracing::{debug, info, warn};

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
    /// `lap_best_lap_time` sampled in the same band and for the same reason.
    mid_lap_best_lap_time: Option<f32>,
    last_track_id: Option<i32>,
    last_car_screen_name: Option<String>,
    /// Last bucket written this lap — lets us fill the buckets skipped between
    /// ticks (e.g. high speed relative to bucket resolution) so they don't
    /// fall back to a default zero-speed sample.
    last_bucket: Option<usize>,
    /// `session_time` on the previous tick, for timing the bucket centres
    /// passed between two ticks.
    prev_session_time: Option<f64>,
    /// `session_time` at which the lap in progress started, interpolated to
    /// the moment the car crossed the line. `None` until a crossing is seen —
    /// a lap joined part-way has no start to time it from.
    lap_start_session_time: Option<f64>,
    /// Set when `lap_dist_pct` was invalid/missing mid-lap (e.g. a pit
    /// teleport) — the resulting position discontinuity can look like a
    /// finish-line crossing even though no real lap was driven, so the
    /// working buffer must not be committed as a new best.
    lap_invalidated: bool,
    /// Set by the delete_reference_lap command; consumed on the next tick so
    /// the in-memory best does not block re-recording after the stored
    /// reference file was deleted.
    reset_requested: bool,
    /// Lap times of the references persisted on disk for the current track+car,
    /// one per condition (refreshed by the telemetry runtime on session-info
    /// updates). A lap is committed only when it beats the stored time *for its
    /// own condition* — which is also what lets a wet lap be recorded at all,
    /// since it will never approach the dry time.
    stored_best_lap_time: StoredReferenceTimes,
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
/// can never differ from it — the lap would then sit unresolved until the next
/// crossing replaced it, silently losing a genuine personal best.
#[derive(Debug)]
struct PendingLap {
    samples: Vec<ReferenceLapSample>,
    condition: TrackCondition,
    recorded_wetness: Option<f32>,
    recorded_tire_wear: Option<f32>,
    recorded_fuel_level: Option<f32>,
    /// The previous lap's `lap_last_lap_time`, sampled mid-lap where available.
    baseline_last_lap_time: Option<f32>,
    /// `lap_best_lap_time` as it read before the crossing, sampled the same way.
    /// The completed lap's time is confirmed by the best *moving* to it.
    baseline_best_lap_time: Option<f32>,
}

/// Average remaining tread (0.0-1.0, 1.0=fresh) across all sampled tire zones, when any are present.
fn average_tire_wear(chassis: &ChassisFrame) -> Option<f32> {
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

/// The sample a `weight` of the way from `from` to `to`; untimed — a bucket's
/// time is stamped when the car passes its centre, never interpolated here.
fn lerp_sample(
    from: &ReferenceLapSample,
    to: &ReferenceLapSample,
    weight: f32,
) -> ReferenceLapSample {
    let lerp = |start: f32, end: f32| start + (end - start) * weight;
    let lerp_optional = |start: Option<f32>, end: Option<f32>| match (start, end) {
        (Some(start), Some(end)) => Some(lerp(start, end)),
        _ => end.or(start),
    };

    ReferenceLapSample {
        speed: lerp(from.speed, to.speed),
        throttle: lerp(from.throttle, to.throttle),
        brake: lerp(from.brake, to.brake),
        lat_accel: lerp_optional(from.lat_accel, to.lat_accel),
        long_accel: lerp_optional(from.long_accel, to.long_accel),
        steering_wheel_angle: lerp(from.steering_wheel_angle, to.steering_wheel_angle),
        time_into_lap: None,
    }
}

impl ReferenceLapProcessor {
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
        self.lap_start_session_time = None;
        self.lap_invalidated = false;
        self.lap_max_wetness = None;
        self.mid_lap_last_lap_time = None;
        self.mid_lap_best_lap_time = None;
    }

    /// Marks the lap in progress unusable. Logged on the transition only —
    /// the reason a personal best never became the reference is otherwise
    /// invisible, and logging it per tick at 60 Hz would drown the log.
    fn invalidate_lap(&mut self, reason: &str) {
        if !self.lap_invalidated {
            debug!("Reference lap: lap in progress invalidated ({reason})");
        }

        self.lap_invalidated = true;
    }

    fn reset_for_new_identity(&mut self) {
        self.reset_for_new_lap();
        self.pending = None;
        self.prev_lap_dist_pct = -1.0;
        self.prev_session_time = None;
    }

    /// Writes `sample` into an unwrapped bucket index — `N..2N` is the lap
    /// after the line — keeping the time the bucket's centre was already
    /// stamped with: a later tick inside the same bucket must not erase it.
    fn write_bucket(&mut self, unwrapped: usize, sample: ReferenceLapSample) {
        let slot = &mut self.working[unwrapped % REFERENCE_LAP_BUCKET_COUNT];

        *slot = ReferenceLapSample {
            time_into_lap: slot.time_into_lap,
            ..sample
        };
    }

    /// Fills the buckets jumped over between the last one written and
    /// `to_unwrapped` along the line between the two samples, for those of
    /// them in `range` (unwrapped indexes). A flat fill with the new sample
    /// alone shifted every skipped bucket to where the car was a tick later.
    fn fill_skipped(
        &mut self,
        previous: Option<(usize, ReferenceLapSample)>,
        to_unwrapped: usize,
        sample: ReferenceLapSample,
        range: std::ops::Range<usize>,
    ) {
        let Some((from, from_sample)) = previous else {
            return;
        };

        if to_unwrapped <= from + 1 {
            return;
        }

        let span = (to_unwrapped - from) as f32;
        let start = range.start.max(from + 1);
        let end = range.end.min(to_unwrapped);

        for unwrapped in start..end {
            let weight = (unwrapped - from) as f32 / span;

            self.write_bucket(unwrapped, lerp_sample(&from_sample, &sample, weight));
        }
    }

    /// Stamps every bucket whose centre the car passed between `from_pct` and
    /// `to_pct` (unwrapped: past 1.0 is the next lap) with the time it got
    /// there, read along the line between the two ticks, in `range`
    /// (unwrapped indexes) and counted from `lap_start`.
    fn stamp_centres(
        &mut self,
        (from_pct, to_pct): (f32, f32),
        (from_time, to_time): (f64, f64),
        lap_start: f64,
        range: std::ops::Range<usize>,
    ) {
        let bucket_count = REFERENCE_LAP_BUCKET_COUNT as f64;
        let from_pct = f64::from(from_pct);
        let to_pct = f64::from(to_pct);
        let first = ((from_pct * bucket_count - 0.5).floor() + 1.0).max(0.0) as usize;
        let last = (to_pct * bucket_count - 0.5).floor();

        if last < 0.0 || to_pct <= from_pct {
            return;
        }

        let end = (last as usize + 1).min(range.end);

        for unwrapped in first.max(range.start)..end {
            let centre = (unwrapped as f64 + 0.5) / bucket_count;
            let weight = (centre - from_pct) / (to_pct - from_pct);
            let at = from_time + (to_time - from_time) * weight;

            self.working[unwrapped % REFERENCE_LAP_BUCKET_COUNT].time_into_lap =
                Some((at - lap_start) as f32);
        }
    }

    /// Commits the parked lap once the sim publishes its time. Returns the
    /// reference lap only when the completed lap actually beats the stored one
    /// for its own condition.
    fn resolve_pending(
        &mut self,
        ctx: &ComputeContext,
        track_id: i32,
        car_screen_name: String,
    ) -> Option<ComputedOutput> {
        let pending = self.pending.as_ref()?;

        // A lap the sim timed as invalid settles too, and is simply dropped:
        // there is no reference to record from a lap that did not count.
        let lap_time = ctx.lap_timing.lap_last_lap_time.filter(|time| *time > 0.0);
        let settled = ctx.lap_timing.lap_last_lap_time.is_some_and(|reading| {
            is_settled_for_reference(
                reading,
                pending.baseline_last_lap_time,
                ctx.lap_timing.lap_current_lap_time,
                ctx.lap_timing.lap_best_lap_time,
                pending.baseline_best_lap_time,
            )
        });

        if !settled {
            return None;
        }

        let pending = self.pending.take()?;
        let lap_time = lap_time?;

        let stored_time = self.stored_best_lap_time.get(pending.condition);
        let beats_stored =
            stored_time.is_none_or(|stored| stored <= 0.0 || lap_time < stored - BEST_TIME_EPSILON);

        if !beats_stored {
            debug!(
                "Reference lap: {:.3}s ({:?}) does not beat the stored reference {:?}",
                lap_time, pending.condition, stored_time
            );

            return None;
        }

        info!(
            "Reference lap: committing {:.3}s ({:?}), previous stored {:?}",
            lap_time, pending.condition, stored_time
        );

        self.stored_best_lap_time
            .set(pending.condition, Some(lap_time));

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
        TickRate::OverlayClock
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        self.ensure_working_buffer();

        if std::mem::take(&mut self.reset_requested) {
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
                self.invalidate_lap("lap_dist_pct missing or negative");

                return None;
            }
        };

        // A pit teleport keeps `lap_dist_pct` valid but makes it jump. Detect
        // any discontinuity that is not the finish-line wrap and invalidate the
        // lap: the forward-fill below would otherwise smear a single stationary
        // pit-stall sample (speed ~0) across every skipped bucket, and a later
        // commit would bake those zeros into the reference lap.
        let mut jumped = false;

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
                jumped = true;
                self.invalidate_lap(&format!(
                    "lap_dist_pct jumped by {delta:.4} (max {max_allowed_jump:.4}) — teleport"
                ));
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
            time_into_lap: None,
        };

        // The crossing is settled *before* this tick's sample is filed: the tick
        // that wraps past the line already belongs to the new lap, so writing it
        // into the working buffer first would hand the completed lap a bucket of
        // the next one's data.
        let previous_pct = self.prev_lap_dist_pct;
        let crossed_finish_line =
            previous_pct > WRAP_HIGH_THRESHOLD && lap_dist_pct < WRAP_LOW_THRESHOLD;
        self.prev_lap_dist_pct = lap_dist_pct;

        // Indexes past `N` are the lap after the line, so one tick across it is
        // filled and timed as the stretch of road it is.
        let bucket_count = REFERENCE_LAP_BUCKET_COUNT;
        let (to_pct, to_unwrapped) = if crossed_finish_line {
            (lap_dist_pct + 1.0, bucket + bucket_count)
        } else {
            (lap_dist_pct, bucket)
        };
        let moved_on = !jumped && previous_pct >= 0.0 && to_pct >= previous_pct;
        let previous = self
            .last_bucket
            .filter(|_| moved_on)
            .map(|last| (last, self.working[last]));
        let clock = match (self.prev_session_time, ctx.session_time) {
            (Some(from), Some(to)) if moved_on && to >= from => Some((from, to)),
            _ => None,
        };
        self.prev_session_time = ctx.session_time;

        // Where on the clock the car crossed the line, between the two ticks.
        let crossed_at = clock.filter(|_| crossed_finish_line).map(|(from, to)| {
            let weight = (1.0 - f64::from(previous_pct)) / f64::from(to_pct - previous_pct);

            from + (to - from) * weight
        });

        // The completed lap's last metres are filed before it is committed.
        self.fill_skipped(previous, to_unwrapped, sample, 0..bucket_count);

        if let (Some(times), Some(lap_start)) = (clock, self.lap_start_session_time) {
            self.stamp_centres((previous_pct, to_pct), times, lap_start, 0..bucket_count);
        }

        if crossed_finish_line {
            // A lap that could not be timed is dropped rather than queued, and
            // a still-unresolved previous lap is replaced: only the lap just
            // driven can be the one the sim is about to publish a time for.
            if self.lap_invalidated {
                warn!("Reference lap: finish line crossed but the lap was invalidated, not queued");
            }

            if self.pending.is_some() {
                warn!("Reference lap: previous lap still unresolved at the next crossing, dropped");
            }

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
                baseline_best_lap_time: self
                    .mid_lap_best_lap_time
                    .or(ctx.lap_timing.lap_best_lap_time),
            });

            self.reset_for_new_lap();
            self.lap_start_session_time = crossed_at;

            // The new lap's first metres, from the line up to the car.
            self.fill_skipped(
                previous,
                to_unwrapped,
                sample,
                bucket_count..2 * bucket_count,
            );

            if let (Some(times), Some(lap_start)) = (clock, crossed_at) {
                self.stamp_centres(
                    (previous_pct, to_pct),
                    times,
                    lap_start,
                    bucket_count..2 * bucket_count,
                );
            }
        }

        self.write_bucket(bucket, sample);
        self.last_bucket = Some(bucket);

        if (BASELINE_SAMPLE_LOW..BASELINE_SAMPLE_HIGH).contains(&lap_dist_pct) {
            if let Some(previous_lap_time) = ctx.lap_timing.lap_last_lap_time {
                self.mid_lap_last_lap_time = Some(previous_lap_time);
            }

            if let Some(previous_best) = ctx.lap_timing.lap_best_lap_time {
                self.mid_lap_best_lap_time = Some(previous_best);
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

    fn command(&mut self, command: &ProcessorCommand) {
        match *command {
            ProcessorCommand::StoredReferenceTimes(times) => self.stored_best_lap_time = times,
            // The in-memory best would otherwise refuse a slower lap as the
            // new reference after the stored one was deleted.
            ProcessorCommand::ResetReferenceLap => {
                self.stored_best_lap_time = StoredReferenceTimes::default();
                self.reset_requested = true;
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests;
