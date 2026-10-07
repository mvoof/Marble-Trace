//! The driving coach's call — BRAKE / GAS / GRIP — against the active reference lap.
//!
//! It used to run at 60 Hz in every window that mounted the coach, against a
//! 10 Hz lap position it had to dead-reckon between updates, and a reloaded
//! window lost the latched call. Here it runs once, on the position of every
//! tick.
//!
//! The signal model is deliberately plain: the car's measured speed, inputs,
//! lateral acceleration and steering against the reference lap's own recorded
//! values at the same lap distance. No mass, grip or tyre physics is inferred —
//! the sim exposes none of it, and a guessed constant would be worse than none.
//!
//! One computation serves every coach on every screen, but a coach may switch
//! the corner-exit calls off, and that changes the state machine (an exit that
//! is not judged leaves the speed-based Gas check to fire instead). So both
//! variants are run side by side and published together.

use std::collections::VecDeque;
use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::capabilities::Capabilities;
use crate::computations::{
    ComputeContext, ComputedOutput, Processor, ProcessorCommand, ProcessorId, TickRate,
};
use crate::model::reference_lap::{ReferenceLapData, ReferenceLapSample};

/// Minimum separation between two detected corner targets, as a fraction of lap distance.
const MIN_CORNER_SEPARATION_PCT: f32 = 0.02;
/// A local speed minimum must drop at least this much (m/s) from the preceding local max to count as a corner.
const MIN_SPEED_DROP_MPS: f32 = 10.0 / 3.6;
/// Reference brake input above this is considered "braking" when walking back a braking zone.
const BRAKE_ON_THRESHOLD: f32 = 0.05;
/// Max buckets between a detected apex and the nearest preceding braking sample (covers brake-release-before-apex coasting).
const MAX_APEX_TO_BRAKE_GAP_BUCKETS: usize = 20;
/// Driver reaction time (s) budgeted into the brake call: the call must fire
/// this much *earlier* than the physical last-possible braking point, or by the
/// time the driver reacts the corner is already unmakeable.
const REACTION_TIME_S: f32 = 0.4;
/// Brake latch release: hold the call until current speed is within this factor
/// of the corner's target speed, so it stays on for the whole braking zone.
const BRAKE_EXIT_SPEED_FACTOR: f32 = 1.03;
/// Brake latch release: the apex counts as passed this far beyond it — a safety
/// valve so a latch that never reaches the target speed cannot stay lit down
/// the following straight.
const BRAKE_APEX_PASS_MARGIN_PCT: f32 = 0.005;
/// Reference throttle above this is "at/near full throttle" for the Gas call.
const GAS_THROTTLE_THRESHOLD: f32 = 0.95;
/// Current speed must trail the reference by at least this (m/s) to *enter* a Gas call.
const GAS_SPEED_DEADZONE_MPS: f32 = 2.0;
/// Gas latch release: exit once the deficit has closed to this (m/s). The gap to
/// the entry deadzone is the hysteresis that keeps the call lit.
const GAS_EXIT_SPEED_DEADZONE_MPS: f32 = 0.5;
/// Gas latch release: exit once the reference starts lifting below this throttle.
const GAS_EXIT_THROTTLE: f32 = 0.8;
/// The braking distance to the next corner must fit this many times over for a Gas call.
const GAS_MARGIN_FACTOR: f32 = 1.5;
/// Don't look further ahead than this for the next corner target.
const MAX_LOOKAHEAD_M: f32 = 500.0;
/// Steering divergence from the reference here beyond which the two laps are on a
/// different line or phase, not at a different speed.
const MAX_STEERING_MISMATCH_RAD: f32 = 0.35;
/// Lateral acceleration divergence (m/s²) from the reference here beyond which the
/// two laps are on a different line or phase.
const MAX_LAT_ACCEL_MISMATCH_MPS2: f32 = 4.0;
/// Curvature (1/m) below this is a straight — no target speed there (radius 2000 m).
const MIN_PROFILE_CURVATURE: f32 = 1.0 / 2000.0;
/// `κ = a_lat / v²` divides by v² — below this speed the estimate is noise.
const MIN_PROFILE_SPEED_MPS: f32 = 5.0;
/// Fraction of buckets that must carry lateral acceleration for the profile to be trusted.
const MIN_PROFILE_COVERAGE: f32 = 0.5;
/// Mid-corner overspeed: current speed above the profile target by this factor calls Brake.
const MID_CORNER_OVERSPEED_FACTOR: f32 = 1.05;
/// Reference brake above this marks the reference braking phase for input comparison.
const TRAIL_BRAKE_PHASE_THRESHOLD: f32 = 0.3;
/// Player brake trailing the reference by more than this while overspeed is under-braking.
const TRAIL_BRAKE_INPUT_DEFICIT: f32 = 0.25;
/// Overspeed vs. the reference (m/s) required before under-braking is called.
const TRAIL_BRAKE_SPEED_DEADZONE_MPS: f32 = 1.0;
/// Reference combined acceleration (m/s²) above which grip comparisons mean anything.
const GRIP_SIGNIFICANT_MPS2: f32 = 6.0;
/// Using less than this share of the reference's combined grip is headroom.
const GRIP_UTILIZATION_RATIO: f32 = 0.7;
/// Grip-headroom Gas only where the reference is driving with at least this throttle.
const GRIP_GAS_MIN_REF_THROTTLE: f32 = 0.5;
/// Throttle above this counts as back on the power when locating a corner exit.
const EXIT_THROTTLE_OPEN: f32 = 0.2;
/// Don't scan further than this past an apex for the reference's full-throttle point.
const MAX_EXIT_ZONE_M: f32 = 400.0;
/// How far past the reference's full-throttle point the exit stays open, to catch a late opening.
const EXIT_TAIL_M: f32 = 100.0;
/// Being this many metres later than the reference on the throttle is worth a call.
const EXIT_LATE_CALL_M: f32 = 5.0;
/// Once on the throttle, trailing the reference pedal by this much is worth a call.
const EXIT_THROTTLE_DEFICIT: f32 = 0.15;
/// A steering reversal smaller than this (rad) is noise, not a correction.
const STEERING_CORRECTION_RAD: f32 = 0.02;
/// Reversals within the sampled window above which the car counts as unsettled.
const MIN_UNSETTLED_REVERSALS: usize = 3;
/// Steering samples kept for the unsettled-car check — a third of a second at 60 Hz.
const STEERING_HISTORY_SIZE: usize = 20;
/// Beyond this the next corner is not worth counting down to yet.
const MAX_CORNER_COUNTDOWN_M: f32 = 600.0;
/// A position this far "ahead" is in fact behind: more than half a lap.
const HALF_LAP_PCT: f32 = 0.5;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CornerTarget {
    /// Apex position as a fraction of lap distance.
    pub dist_pct: f32,
    /// Apex (minimum) speed of the reference lap, m/s.
    pub target_speed: f32,
    /// Where the reference driver first braked for this corner.
    pub brake_start_pct: f32,
    /// Deceleration (m/s²) the reference lap achieved braking into this corner.
    pub braking_decel: f32,
    /// Where the reference got back on the throttle after the apex, when it did
    /// within `MAX_EXIT_ZONE_M`.
    pub throttle_open_pct: Option<f32>,
    /// End of the exit phase: `EXIT_TAIL_M` past the reference's full-throttle
    /// point, capped at the scan window. `None` together with `throttle_open_pct`.
    pub exit_end_pct: Option<f32>,
}

/// `Grip` is not an instruction but a refusal to give one: the car is being
/// caught and corrected, and a Gas call would be wrong advice.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum DrivingAdvisory {
    Brake,
    Gas,
    Grip,
    #[default]
    Neutral,
}

/// The call plus the latch bookkeeping that keeps it lit across a whole zone.
/// Entry and exit conditions differ on purpose (hysteresis).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct AdvisoryState {
    pub advisory: DrivingAdvisory,
    /// Apex of the corner the Brake latch is held for.
    pub brake_corner_pct: Option<f32>,
    /// `d_required / d_remaining` toward the next corner, clamped to [0, 1].
    pub brake_urgency: f32,
    /// Apex of the corner exit the car is in.
    pub exit_corner_pct: Option<f32>,
    /// Where the player first opened the throttle in this exit.
    pub exit_throttle_open_pct: Option<f32>,
    /// Metres later than the reference the throttle was opened — counting up
    /// while still off the pedal, frozen once on it. `None` outside an exit, or
    /// when on the power at or before the reference.
    pub exit_late_m: Option<f32>,
    /// Pedal the reference carries here that this lap does not, 0-1, in an exit only.
    pub exit_throttle_deficit: f32,
}

pub const NEUTRAL_ADVISORY_STATE: AdvisoryState = AdvisoryState {
    advisory: DrivingAdvisory::Neutral,
    brake_corner_pct: None,
    brake_urgency: 0.0,
    exit_corner_pct: None,
    exit_throttle_open_pct: None,
    exit_late_m: None,
    exit_throttle_deficit: 0.0,
};

/// Why the coach is not producing a call. A neutral call alone would read as
/// "you are on the pace" while the coach is in fact switched off.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
// Each reason names what is missing, so they all start with it.
#[allow(clippy::enum_variant_names)]
pub enum CoachInactiveReason {
    NoReference,
    NoTrackData,
    NoCorners,
    NoTelemetry,
}

/// What one coach shows: the call and the corner-exit figures beside it.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct CoachCall {
    pub advisory: DrivingAdvisory,
    pub brake_urgency: f32,
    pub exit_late_m: Option<f32>,
    pub exit_throttle_deficit: f32,
}

impl From<&AdvisoryState> for CoachCall {
    fn from(state: &AdvisoryState) -> Self {
        Self {
            advisory: state.advisory,
            brake_urgency: state.brake_urgency,
            exit_late_m: state.exit_late_m,
            exit_throttle_deficit: state.exit_throttle_deficit,
        }
    }
}

/// The coach, for every coach on every screen. Each reads the variant its own
/// corner-exit setting asks for.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct CoachFrame {
    pub inactive_reason: Option<CoachInactiveReason>,
    pub with_exit_calls: CoachCall,
    pub without_exit_calls: CoachCall,
    /// Metres to the next apex, when one is close enough to count down to.
    pub apex_distance_m: Option<f32>,
    /// Metres to where the reference braked for the next corner — `None` once
    /// inside that braking zone, where a countdown to a point behind would lie.
    pub brake_point_distance_m: Option<f32>,
}

/// Distance ahead from `from_pct` to `to_pct`, wrapping around the lap, in `[0, 1)`.
fn pct_distance_ahead(from_pct: f32, to_pct: f32) -> f32 {
    let diff = to_pct - from_pct;

    if diff >= 0.0 {
        diff
    } else {
        diff + 1.0
    }
}

fn lerp(from: f32, to: f32, weight: f32) -> f32 {
    from * (1.0 - weight) + to * weight
}

fn lerp_optional(from: Option<f32>, to: Option<f32>, weight: f32) -> Option<f32> {
    match (from, to) {
        (Some(from), Some(to)) => Some(lerp(from, to, weight)),
        _ => from.or(to),
    }
}

/// Reference sample linearly interpolated at `lap_dist_pct`, wrapping across the
/// line. Each bucket holds the value of the interval `[i/N, (i+1)/N)`, so it is
/// treated as located at the interval centre `(i + 0.5)/N`:
///
///   x = lap_dist_pct * N - 0.5,   t = frac(x)
///   value = sample[floor(x)] * (1 - t) + sample[floor(x) + 1] * t
///
/// At ~5 m a bucket a fast car crosses more than one per tick; nearest-bucket
/// lookup would step by up to a bucket.
pub fn interpolate_reference_sample(
    samples: &[ReferenceLapSample],
    lap_dist_pct: f32,
) -> Option<ReferenceLapSample> {
    let bucket_count = samples.len();

    if bucket_count == 0 {
        return None;
    }

    let position = lap_dist_pct * bucket_count as f32 - 0.5;
    let floor = position.floor();
    let lower_bucket = (floor as i64).rem_euclid(bucket_count as i64) as usize;
    let upper_bucket = (lower_bucket + 1) % bucket_count;
    let weight = position - floor;

    let lower = &samples[lower_bucket];
    let upper = &samples[upper_bucket];

    Some(ReferenceLapSample {
        speed: lerp(lower.speed, upper.speed, weight),
        throttle: lerp(lower.throttle, upper.throttle, weight),
        brake: lerp(lower.brake, upper.brake, weight),
        lat_accel: lerp_optional(lower.lat_accel, upper.lat_accel, weight),
        long_accel: lerp_optional(lower.long_accel, upper.long_accel, weight),
        steering_wheel_angle: lerp(
            lower.steering_wheel_angle,
            upper.steering_wheel_angle,
            weight,
        ),
    })
}

/// Per-bucket physics target speed from the reference lap, `None` where nothing
/// constrains it (straights, missing data).
///
/// Curvature comes from circular motion, `κ = a_lat / v²`; the lap's highest
/// combined acceleration `a_max = max √(a_lat² + a_long²)` is taken as the grip
/// available, and `v_target = √(a_max / κ)`, never below the reference's own
/// speed there. That turns the apex-only target into a profile, so overspeed is
/// caught mid-corner too.
pub fn build_target_speed_profile(samples: &[ReferenceLapSample]) -> Option<Vec<Option<f32>>> {
    let bucket_count = samples.len();

    if bucket_count == 0 {
        return None;
    }

    let mut max_combined_accel = 0.0_f32;
    let mut lat_accel_coverage = 0_usize;

    for sample in samples {
        let Some(lat_accel) = sample.lat_accel else {
            continue;
        };

        lat_accel_coverage += 1;
        max_combined_accel =
            max_combined_accel.max(lat_accel.hypot(sample.long_accel.unwrap_or(0.0)));
    }

    if (lat_accel_coverage as f32 / bucket_count as f32) < MIN_PROFILE_COVERAGE
        || max_combined_accel <= 0.0
    {
        return None;
    }

    let profile = samples
        .iter()
        .map(|sample| {
            let lat_accel = sample.lat_accel?;

            if sample.speed < MIN_PROFILE_SPEED_MPS {
                return None;
            }

            let curvature = lat_accel.abs() / sample.speed.powi(2);

            if curvature < MIN_PROFILE_CURVATURE {
                return None;
            }

            Some((max_combined_accel / curvature).sqrt().max(sample.speed))
        })
        .collect();

    Some(profile)
}

/// Profile lookup at `lap_dist_pct` — nearest bucket, the profile is already smooth.
fn target_speed_at(profile: Option<&[Option<f32>]>, lap_dist_pct: f32) -> Option<f32> {
    let profile = profile.filter(|profile| !profile.is_empty())?;
    let bucket =
        ((lap_dist_pct * profile.len() as f32).floor().max(0.0) as usize).min(profile.len() - 1);

    profile[bucket]
}

struct BrakingZone {
    brake_start_pct: f32,
    decel: f32,
}

/// Walks back from the apex to the nearest braking zone (allowing a short coast
/// between release and apex) and derives its average deceleration from
/// `v1² = v0² - 2·a·ds`, so `a = (v0² - v1²) / (2·ds)`.
fn derive_braking_zone(
    samples: &[ReferenceLapSample],
    apex_index: usize,
    track_length_m: f32,
) -> Option<BrakingZone> {
    let bucket_count = samples.len();
    let mut brake_end_index = apex_index;

    while brake_end_index > 0
        && samples[brake_end_index].brake <= BRAKE_ON_THRESHOLD
        && apex_index - brake_end_index < MAX_APEX_TO_BRAKE_GAP_BUCKETS
    {
        brake_end_index -= 1;
    }

    if samples[brake_end_index].brake <= BRAKE_ON_THRESHOLD {
        return None;
    }

    let mut brake_start_index = brake_end_index;

    while brake_start_index > 0 && samples[brake_start_index - 1].brake > BRAKE_ON_THRESHOLD {
        brake_start_index -= 1;
    }

    if brake_start_index == brake_end_index {
        return None;
    }

    let speed_start = samples[brake_start_index].speed;
    let speed_end = samples[apex_index].speed;
    let buckets_spanned = (apex_index - brake_start_index) as f32;
    let delta_distance_m = buckets_spanned / bucket_count as f32 * track_length_m;

    if delta_distance_m <= 0.0 || speed_start <= speed_end {
        return None;
    }

    Some(BrakingZone {
        brake_start_pct: brake_start_index as f32 / bucket_count as f32,
        decel: (speed_start.powi(2) - speed_end.powi(2)) / (2.0 * delta_distance_m),
    })
}

struct ExitZone {
    throttle_open_pct: f32,
    exit_end_pct: f32,
}

/// Walks forward from the apex to the exit phase of the reference: where it
/// opened the throttle, and where it reached full throttle. A reference that
/// never gets there within `MAX_EXIT_ZONE_M` ends the zone at the scan limit.
fn derive_exit_zone(
    samples: &[ReferenceLapSample],
    apex_index: usize,
    track_length_m: f32,
) -> Option<ExitZone> {
    let bucket_count = samples.len();
    let buckets_over =
        |metres: f32| (metres / track_length_m * bucket_count as f32).round() as usize;
    let scan_buckets = buckets_over(MAX_EXIT_ZONE_M);

    if scan_buckets == 0 {
        return None;
    }

    let throttle_at = |offset: usize| samples[(apex_index + offset) % bucket_count].throttle;
    let open_offset =
        (0..=scan_buckets).find(|&offset| throttle_at(offset) > EXIT_THROTTLE_OPEN)?;
    let full_throttle_offset = (open_offset..=scan_buckets)
        .find(|&offset| throttle_at(offset) >= GAS_THROTTLE_THRESHOLD)
        .unwrap_or(scan_buckets);

    // The zone runs a tail past the reference's full-throttle point: a driver
    // late on the power is by definition still short of it, and ending the zone
    // there would close the measurement exactly when it starts to matter.
    let end_offset = (full_throttle_offset + buckets_over(EXIT_TAIL_M)).min(scan_buckets);

    if end_offset == 0 {
        return None;
    }

    let pct_of =
        |offset: usize| ((apex_index + offset) % bucket_count) as f32 / bucket_count as f32;

    Some(ExitZone {
        throttle_open_pct: pct_of(open_offset),
        exit_end_pct: pct_of(end_offset),
    })
}

/// Scans a completed reference lap for corner apexes (local speed minima) and
/// the deceleration actually achieved braking into each.
pub fn extract_corner_targets(
    samples: &[ReferenceLapSample],
    track_length_m: f32,
) -> Vec<CornerTarget> {
    let bucket_count = samples.len();

    if bucket_count < 3 || track_length_m <= 0.0 {
        return Vec::new();
    }

    let mut targets = Vec::new();
    let mut running_max_speed = samples[0].speed;
    let mut last_target_dist_pct: Option<f32> = None;

    for index in 1..bucket_count - 1 {
        let speed = samples[index].speed;

        running_max_speed = running_max_speed.max(speed);

        let is_local_min = speed < samples[index - 1].speed && speed <= samples[index + 1].speed;

        if !is_local_min {
            continue;
        }

        let dist_pct = index as f32 / bucket_count as f32;

        if running_max_speed - speed < MIN_SPEED_DROP_MPS {
            continue;
        }

        if last_target_dist_pct
            .is_some_and(|last| pct_distance_ahead(last, dist_pct) < MIN_CORNER_SEPARATION_PCT)
        {
            continue;
        }

        let Some(braking_zone) = derive_braking_zone(samples, index, track_length_m) else {
            continue;
        };

        let exit_zone = derive_exit_zone(samples, index, track_length_m);

        targets.push(CornerTarget {
            dist_pct,
            target_speed: speed,
            brake_start_pct: braking_zone.brake_start_pct,
            braking_decel: braking_zone.decel,
            throttle_open_pct: exit_zone.as_ref().map(|zone| zone.throttle_open_pct),
            exit_end_pct: exit_zone.as_ref().map(|zone| zone.exit_end_pct),
        });
        last_target_dist_pct = Some(dist_pct);
        running_max_speed = speed;
    }

    targets
}

/// Nearest corner target strictly ahead, within `MAX_LOOKAHEAD_M`.
pub fn find_next_corner_target(
    corner_targets: &[CornerTarget],
    current_dist_pct: f32,
    track_length_m: f32,
) -> Option<&CornerTarget> {
    corner_targets
        .iter()
        .map(|target| {
            let distance_m = pct_distance_ahead(current_dist_pct, target.dist_pct) * track_length_m;

            (target, distance_m)
        })
        .filter(|(_, distance_m)| *distance_m > 0.0 && *distance_m <= MAX_LOOKAHEAD_M)
        .min_by(|(_, left), (_, right)| left.total_cmp(right))
        .map(|(target, _)| target)
}

/// Whether steering or lateral load diverge enough from the reference here that
/// the two laps are not in the same phase of the corner.
fn is_trajectory_mismatch(
    current_steering: f32,
    reference_steering: Option<f32>,
    current_lat_accel: Option<f32>,
    reference_lat_accel: Option<f32>,
) -> bool {
    if reference_steering
        .is_some_and(|reference| (current_steering - reference).abs() > MAX_STEERING_MISMATCH_RAD)
    {
        return true;
    }

    matches!(
        (current_lat_accel, reference_lat_accel),
        (Some(current), Some(reference)) if (current - reference).abs() > MAX_LAT_ACCEL_MISMATCH_MPS2
    )
}

pub struct AdvisoryInput<'a> {
    pub current_speed: f32,
    pub current_throttle: f32,
    pub current_brake: f32,
    pub current_dist_pct: f32,
    pub track_length_m: f32,
    pub corner_targets: &'a [CornerTarget],
    pub reference_samples: &'a [ReferenceLapSample],
    pub target_speed_profile: Option<&'a [Option<f32>]>,
    /// ABS is intervening — the driver is already at maximum braking.
    pub brake_abs_active: bool,
    pub current_steering_wheel_angle: f32,
    pub current_lat_accel: Option<f32>,
    pub current_long_accel: Option<f32>,
    /// The car is being caught and corrected right now (`is_steering_unsettled`).
    pub steering_unsettled: bool,
    pub corner_exit_calls_enabled: bool,
}

/// Distance (m) needed to slow to the corner's target speed:
///
///   d = (v² - v_target²) / (2·a)  +  v · t_reaction
///
/// at the reference's own demonstrated deceleration, plus the distance covered
/// before the driver reacts to the call.
fn required_brake_distance_m(current_speed: f32, target: &CornerTarget) -> f32 {
    if current_speed <= target.target_speed {
        return 0.0;
    }

    let kinematic_m =
        (current_speed.powi(2) - target.target_speed.powi(2)) / (2.0 * target.braking_decel);

    kinematic_m + current_speed * REACTION_TIME_S
}

/// Whether `dist_pct` lies in the reference braking zone `[brake_start, apex)`, wrapping.
fn is_inside_braking_zone(dist_pct: f32, target: &CornerTarget) -> bool {
    let zone_length_pct = pct_distance_ahead(target.brake_start_pct, target.dist_pct);

    pct_distance_ahead(target.brake_start_pct, dist_pct) < zone_length_pct
}

/// Whether the wheel is being worked back and forth — catching the car rather
/// than describing an arc. Counts reversals larger than `STEERING_CORRECTION_RAD`;
/// a smooth arc, however fast, has none.
pub fn is_steering_unsettled<'a>(recent_angles: impl IntoIterator<Item = &'a f32>) -> bool {
    let mut reversals = 0;
    let mut last_direction = 0.0_f32;
    let mut previous: Option<f32> = None;

    for &angle in recent_angles {
        let Some(before) = previous.replace(angle) else {
            continue;
        };

        let delta = angle - before;

        if delta.abs() < STEERING_CORRECTION_RAD {
            continue;
        }

        let direction = delta.signum();

        if last_direction != 0.0 && direction != last_direction {
            reversals += 1;
        }

        last_direction = direction;
    }

    reversals >= MIN_UNSETTLED_REVERSALS
}

/// The corner whose exit phase contains `current_dist_pct`.
fn find_exit_zone_target(
    corner_targets: &[CornerTarget],
    current_dist_pct: f32,
) -> Option<&CornerTarget> {
    corner_targets.iter().find(|target| {
        target.exit_end_pct.is_some_and(|exit_end_pct| {
            pct_distance_ahead(target.dist_pct, current_dist_pct)
                < pct_distance_ahead(target.dist_pct, exit_end_pct)
        })
    })
}

#[derive(Clone, Copy)]
struct ExitBookkeeping {
    exit_corner_pct: Option<f32>,
    exit_throttle_open_pct: Option<f32>,
    exit_late_m: Option<f32>,
    exit_throttle_deficit: f32,
    /// The call this exit warrants, or `None` while it is driven on the reference.
    advisory: Option<DrivingAdvisory>,
}

const IDLE_EXIT_BOOKKEEPING: ExitBookkeeping = ExitBookkeeping {
    exit_corner_pct: None,
    exit_throttle_open_pct: None,
    exit_late_m: None,
    exit_throttle_deficit: 0.0,
    advisory: None,
};

impl ExitBookkeeping {
    fn onto(self, state: AdvisoryState) -> AdvisoryState {
        AdvisoryState {
            exit_corner_pct: self.exit_corner_pct,
            exit_throttle_open_pct: self.exit_throttle_open_pct,
            exit_late_m: self.exit_late_m,
            exit_throttle_deficit: self.exit_throttle_deficit,
            ..state
        }
    }
}

/// The corner-exit branch: what the driver does with the throttle coming out,
/// not the speed it produces later — speed on an exit lags the pedal by the
/// length of the following straight.
///
/// While still off the power past the reference's opening point the late figure
/// counts up live — the only window in which the driver can act on it — then
/// freezes where they opened, and stays readable as a score for the corner. A
/// car being corrected reports `Grip`: adding throttle mid-correction is bad advice.
fn resolve_corner_exit(
    corner_targets: &[CornerTarget],
    current_dist_pct: f32,
    track_length_m: f32,
    current_throttle: f32,
    reference: Option<&ReferenceLapSample>,
    steering_unsettled: bool,
    previous: &AdvisoryState,
) -> ExitBookkeeping {
    let Some(target) = find_exit_zone_target(corner_targets, current_dist_pct) else {
        return IDLE_EXIT_BOOKKEEPING;
    };

    let (Some(reference_open_pct), Some(reference)) = (target.throttle_open_pct, reference) else {
        return IDLE_EXIT_BOOKKEEPING;
    };

    // Bookkeeping carries over within the same exit only — a new corner starts clean.
    let carried = if previous.exit_corner_pct == Some(target.dist_pct) {
        previous.exit_throttle_open_pct
    } else {
        None
    };
    let on_throttle = current_throttle > EXIT_THROTTLE_OPEN;
    let throttle_open_pct = carried.or(on_throttle.then_some(current_dist_pct));

    // More than half a lap "ahead" means behind: opening before the reference is no deficit.
    let past_reference_open = |pct: f32| {
        let gap = pct_distance_ahead(reference_open_pct, pct);

        (gap > 0.0 && gap < HALF_LAP_PCT).then_some(gap * track_length_m)
    };

    let exit_late_m = past_reference_open(throttle_open_pct.unwrap_or(current_dist_pct));
    let exit_throttle_deficit = (reference.throttle - current_throttle).clamp(0.0, 1.0);

    // Late off the power past the reference's opening, or on it with pedal missing.
    let still_late =
        throttle_open_pct.is_none() && exit_late_m.is_some_and(|late| late >= EXIT_LATE_CALL_M);
    let short_on_pedal = on_throttle && exit_throttle_deficit >= EXIT_THROTTLE_DEFICIT;

    let advisory = if steering_unsettled {
        Some(DrivingAdvisory::Grip)
    } else if still_late || short_on_pedal {
        Some(DrivingAdvisory::Gas)
    } else {
        None
    };

    ExitBookkeeping {
        exit_corner_pct: Some(target.dist_pct),
        exit_throttle_open_pct: throttle_open_pct,
        exit_late_m,
        exit_throttle_deficit,
        advisory,
    }
}

/// Combined acceleration `√(a_lat² + a_long²)` — the grip in use — or `None` without lateral data.
fn combined_accel(lat_accel: Option<f32>, long_accel: Option<f32>) -> Option<f32> {
    lat_accel.map(|lat| lat.hypot(long_accel.unwrap_or(0.0)))
}

fn brake_call(brake_corner_pct: Option<f32>) -> AdvisoryState {
    AdvisoryState {
        advisory: DrivingAdvisory::Brake,
        brake_corner_pct,
        brake_urgency: 1.0,
        ..NEUTRAL_ADVISORY_STATE
    }
}

fn call_with_urgency(advisory: DrivingAdvisory, brake_urgency: f32) -> AdvisoryState {
    AdvisoryState {
        advisory,
        brake_urgency,
        ..NEUTRAL_ADVISORY_STATE
    }
}

/// The zone-latched call.
///
/// **Brake** — cannot shed the speed by the next apex at the reference's own
/// deceleration; overspeed inside the reference braking zone; mid-corner
/// overspeed against the profile; or under-braking in the reference braking
/// phase (pedal or grip well short of it while faster). Once latched onto a
/// corner it holds until the target speed is reached or the apex is passed.
///
/// **Corner exit** — judged on the throttle (`resolve_corner_exit`), ahead of
/// the speed-based Gas check, which cannot see this phase.
///
/// **Gas** — under-driving a section the reference took flat out, or leaving
/// grip unused on a driving section, by at least the entry deadzone; holds until
/// the deficit closes or the reference starts lifting.
///
/// `brake_urgency` is always reported, so the UI can pre-arm before the call.
pub fn compute_driving_advisory(input: &AdvisoryInput, previous: &AdvisoryState) -> AdvisoryState {
    if input.track_length_m <= 0.0 {
        return NEUTRAL_ADVISORY_STATE;
    }

    let reference = interpolate_reference_sample(input.reference_samples, input.current_dist_pct);
    let trajectory_mismatch = is_trajectory_mismatch(
        input.current_steering_wheel_angle,
        reference.as_ref().map(|sample| sample.steering_wheel_angle),
        input.current_lat_accel,
        reference.as_ref().and_then(|sample| sample.lat_accel),
    );

    let next_target = find_next_corner_target(
        input.corner_targets,
        input.current_dist_pct,
        input.track_length_m,
    );
    let remaining_to_apex_m = next_target.map(|target| {
        pct_distance_ahead(input.current_dist_pct, target.dist_pct) * input.track_length_m
    });
    let brake_urgency = match (next_target, remaining_to_apex_m) {
        (Some(target), Some(remaining)) if remaining > 0.0 => {
            (required_brake_distance_m(input.current_speed, target) / remaining).min(1.0)
        }
        _ => 0.0,
    };

    let exit = if input.corner_exit_calls_enabled {
        resolve_corner_exit(
            input.corner_targets,
            input.current_dist_pct,
            input.track_length_m,
            input.current_throttle,
            reference.as_ref(),
            input.steering_unsettled,
            previous,
        )
    } else {
        IDLE_EXIT_BOOKKEEPING
    };

    if previous.advisory == DrivingAdvisory::Brake {
        if let Some(brake_corner_pct) = previous.brake_corner_pct {
            let latched_target = input
                .corner_targets
                .iter()
                .find(|target| target.dist_pct == brake_corner_pct);

            // The latch releases only once slowed to the apex speed or clearly
            // past the apex — that is what keeps the call on for the whole zone.
            let distance_past_apex_pct =
                pct_distance_ahead(brake_corner_pct, input.current_dist_pct);
            let apex_passed = distance_past_apex_pct > BRAKE_APEX_PASS_MARGIN_PCT
                && distance_past_apex_pct < HALF_LAP_PCT;
            let still_overspeed = latched_target.is_some_and(|target| {
                input.current_speed > target.target_speed * BRAKE_EXIT_SPEED_FACTOR
            });

            if !apex_passed && still_overspeed {
                return exit.onto(AdvisoryState {
                    brake_urgency: 1.0,
                    ..*previous
                });
            }
        }
    }

    // A Brake call holds even on a different line — overspeeding toward an apex
    // must brake regardless — so trajectory mismatch does not gate it. ABS
    // intervening means the driver is already at maximum braking.
    if !input.brake_abs_active {
        if let (Some(target), Some(remaining)) = (next_target, remaining_to_apex_m) {
            if input.current_speed > target.target_speed {
                let infeasible =
                    required_brake_distance_m(input.current_speed, target) >= remaining;

                if infeasible || is_inside_braking_zone(input.current_dist_pct, target) {
                    return exit.onto(brake_call(Some(target.dist_pct)));
                }
            }
        }

        let next_target_pct = next_target.map(|target| target.dist_pct);

        // Carrying too much speed *through* a corner, which the apex check cannot see.
        if target_speed_at(input.target_speed_profile, input.current_dist_pct).is_some_and(
            |profile_target| input.current_speed > profile_target * MID_CORNER_OVERSPEED_FACTOR,
        ) {
            return exit.onto(brake_call(next_target_pct));
        }

        // Under-braking in the reference braking phase: faster than the reference
        // and well short of its pedal or of the grip it used.
        if let Some(reference) = reference.as_ref().filter(|reference| {
            reference.brake >= TRAIL_BRAKE_PHASE_THRESHOLD
                && input.current_speed > reference.speed + TRAIL_BRAKE_SPEED_DEADZONE_MPS
        }) {
            let brake_input_deficit =
                input.current_brake < reference.brake - TRAIL_BRAKE_INPUT_DEFICIT;
            let grip_deficit = matches!(
                (
                    combined_accel(reference.lat_accel, reference.long_accel),
                    combined_accel(input.current_lat_accel, input.current_long_accel),
                ),
                (Some(reference_grip), Some(current_grip))
                    if reference_grip > GRIP_SIGNIFICANT_MPS2
                        && current_grip < reference_grip * GRIP_UTILIZATION_RATIO
            );

            if brake_input_deficit || grip_deficit {
                return exit.onto(brake_call(next_target_pct));
            }
        }
    }

    if let Some(advisory) = exit.advisory {
        return exit.onto(call_with_urgency(advisory, brake_urgency));
    }

    // Gas compares like-for-like driving, so a different line or phase invalidates it.
    if let Some(reference) = reference.as_ref().filter(|_| !trajectory_mismatch) {
        let gas_latched = previous.advisory == DrivingAdvisory::Gas;
        let deficit_mps = if gas_latched {
            GAS_EXIT_SPEED_DEADZONE_MPS
        } else {
            GAS_SPEED_DEADZONE_MPS
        };
        let throttle_floor = if gas_latched {
            GAS_EXIT_THROTTLE
        } else {
            GAS_THROTTLE_THRESHOLD
        };

        let flat_out_deficit =
            reference.throttle >= throttle_floor && input.current_throttle < reference.throttle;
        // Grip unused on a driving (non-braking) section — the exit has more to give.
        let grip_headroom = reference.brake < BRAKE_ON_THRESHOLD
            && reference.throttle >= GRIP_GAS_MIN_REF_THROTTLE
            && matches!(
                (
                    combined_accel(reference.lat_accel, reference.long_accel),
                    combined_accel(input.current_lat_accel, input.current_long_accel),
                ),
                (Some(reference_grip), Some(current_grip))
                    if reference_grip > GRIP_SIGNIFICANT_MPS2
                        && current_grip < reference_grip * GRIP_UTILIZATION_RATIO
            );

        let under_driving = input.current_speed < reference.speed - deficit_mps
            && (flat_out_deficit || grip_headroom);

        if under_driving {
            // Never Gas when the next corner leaves too little braking margin.
            let leaves_margin = match (next_target, remaining_to_apex_m) {
                (Some(target), Some(remaining)) => {
                    required_brake_distance_m(input.current_speed, target) * GAS_MARGIN_FACTOR
                        < remaining
                }
                _ => true,
            };

            if leaves_margin {
                return exit.onto(call_with_urgency(DrivingAdvisory::Gas, brake_urgency));
            }
        }
    }

    exit.onto(call_with_urgency(DrivingAdvisory::Neutral, brake_urgency))
}

/// Metres from `from_pct` forward to `target_pct`, or `None` when too far to count down to.
fn countdown_m(from_pct: f32, target_pct: f32, track_length_m: f32) -> Option<f32> {
    let distance_m = pct_distance_ahead(from_pct, target_pct) * track_length_m;

    (distance_m <= MAX_CORNER_COUNTDOWN_M).then_some(distance_m)
}

/// What the reference lap gives the coach, rebuilt only when it or the track changes.
struct CoachModel {
    reference: Arc<ReferenceLapData>,
    track_length_m: f32,
    corner_targets: Vec<CornerTarget>,
    target_speed_profile: Option<Vec<Option<f32>>>,
}

impl CoachModel {
    fn build(reference: Arc<ReferenceLapData>, track_length_m: f32) -> Self {
        let corner_targets = extract_corner_targets(&reference.samples, track_length_m);
        let target_speed_profile = build_target_speed_profile(&reference.samples);

        Self {
            reference,
            track_length_m,
            corner_targets,
            target_speed_profile,
        }
    }

    /// The corner whose apex is next ahead, at any distance, wrapping across the line.
    fn next_apex(&self, current_dist_pct: f32) -> Option<&CornerTarget> {
        self.corner_targets.iter().min_by(|left, right| {
            pct_distance_ahead(current_dist_pct, left.dist_pct)
                .total_cmp(&pct_distance_ahead(current_dist_pct, right.dist_pct))
        })
    }
}

#[derive(Default)]
pub struct CoachProcessor {
    reference: Option<Arc<ReferenceLapData>>,
    model: Option<CoachModel>,
    with_exit_calls: Option<AdvisoryState>,
    without_exit_calls: Option<AdvisoryState>,
    steering_history: VecDeque<f32>,
}

impl CoachProcessor {
    fn model_for(&mut self, track_length_m: f32) -> Option<&CoachModel> {
        let reference = self.reference.as_ref()?;
        let stale = self.model.as_ref().is_none_or(|model| {
            !Arc::ptr_eq(&model.reference, reference) || model.track_length_m != track_length_m
        });

        if stale {
            self.model = Some(CoachModel::build(reference.clone(), track_length_m));
        }

        self.model.as_ref()
    }

    fn idle(&mut self, reason: CoachInactiveReason) -> CoachFrame {
        self.with_exit_calls = None;
        self.without_exit_calls = None;

        CoachFrame {
            inactive_reason: Some(reason),
            ..CoachFrame::default()
        }
    }

    fn frame(&mut self, ctx: &ComputeContext) -> CoachFrame {
        if self.reference.is_none() {
            return self.idle(CoachInactiveReason::NoReference);
        }

        if ctx.track_length_m <= 0.0 {
            return self.idle(CoachInactiveReason::NoTrackData);
        }

        if self
            .model_for(ctx.track_length_m)
            .is_none_or(|model| model.corner_targets.is_empty())
        {
            return self.idle(CoachInactiveReason::NoCorners);
        }

        let Some(current_dist_pct) = ctx.lap_timing.lap_dist_pct.filter(|pct| *pct >= 0.0) else {
            return self.idle(CoachInactiveReason::NoTelemetry);
        };

        let dynamics = ctx.car_dynamics;
        let inputs = ctx.car_inputs;

        self.steering_history
            .push_back(dynamics.steering_wheel_angle);

        if self.steering_history.len() > STEERING_HISTORY_SIZE {
            self.steering_history.pop_front();
        }

        let steering_unsettled = is_steering_unsettled(&self.steering_history);
        let previous_with = self.with_exit_calls.unwrap_or(NEUTRAL_ADVISORY_STATE);
        let previous_without = self.without_exit_calls.unwrap_or(NEUTRAL_ADVISORY_STATE);

        let Some(model) = self.model.as_ref() else {
            return self.idle(CoachInactiveReason::NoCorners);
        };

        let input = |corner_exit_calls_enabled: bool| AdvisoryInput {
            current_speed: dynamics.speed,
            current_throttle: inputs.throttle,
            current_brake: inputs.brake,
            current_dist_pct,
            track_length_m: model.track_length_m,
            corner_targets: &model.corner_targets,
            reference_samples: &model.reference.samples,
            target_speed_profile: model.target_speed_profile.as_deref(),
            brake_abs_active: inputs.brake_abs_active,
            current_steering_wheel_angle: dynamics.steering_wheel_angle,
            current_lat_accel: dynamics.lat_accel,
            current_long_accel: dynamics.long_accel,
            steering_unsettled,
            corner_exit_calls_enabled,
        };

        let with_exit_calls = compute_driving_advisory(&input(true), &previous_with);
        let without_exit_calls = compute_driving_advisory(&input(false), &previous_without);

        let next_apex = model.next_apex(current_dist_pct);
        let apex_distance_m = next_apex.and_then(|target| {
            countdown_m(current_dist_pct, target.dist_pct, model.track_length_m)
        });
        let brake_point_distance_m = next_apex.and_then(|target| {
            let brake_gap = pct_distance_ahead(current_dist_pct, target.brake_start_pct);
            let apex_gap = pct_distance_ahead(current_dist_pct, target.dist_pct);

            (brake_gap <= apex_gap)
                .then(|| {
                    countdown_m(
                        current_dist_pct,
                        target.brake_start_pct,
                        model.track_length_m,
                    )
                })
                .flatten()
        });

        self.with_exit_calls = Some(with_exit_calls);
        self.without_exit_calls = Some(without_exit_calls);

        CoachFrame {
            inactive_reason: None,
            with_exit_calls: CoachCall::from(&with_exit_calls),
            without_exit_calls: CoachCall::from(&without_exit_calls),
            apex_distance_m,
            brake_point_distance_m,
        }
    }
}

impl Processor for CoachProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::Coach
    }

    fn required(&self) -> Capabilities {
        Capabilities::empty()
    }

    fn rate(&self) -> TickRate {
        TickRate::Hz60
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        Some(ComputedOutput::Coach(self.frame(ctx)))
    }

    fn reset(&mut self) {
        *self = Self::default();
    }

    fn command(&mut self, command: &ProcessorCommand) {
        if let ProcessorCommand::ActiveReference(reference) = command {
            self.reference = reference.clone();
            self.model = None;
            self.with_exit_calls = None;
            self.without_exit_calls = None;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TRACK_LENGTH_M: f32 = 1000.0;
    const BUCKET_COUNT: usize = 1000;

    fn sample(speed: f32, throttle: f32, brake: f32, lat_accel: Option<f32>) -> ReferenceLapSample {
        ReferenceLapSample {
            speed,
            throttle,
            brake,
            lat_accel,
            long_accel: Some(0.0),
            steering_wheel_angle: 0.0,
        }
    }

    fn plain(speed: f32, throttle: f32, brake: f32) -> ReferenceLapSample {
        sample(speed, throttle, brake, Some(0.0))
    }

    /// A straight, a braking zone, an apex and an exit spanning the whole lap.
    fn corner_samples() -> Vec<ReferenceLapSample> {
        (0..BUCKET_COUNT)
            .map(|index| match index {
                0..400 => plain(60.0, 1.0, 0.0),
                400..450 => plain(60.0 - (index - 400) as f32, 0.0, 0.8),
                450..460 => plain(10.0, 0.0, 0.0),
                _ => plain(10.0 + (index - 460) as f32 * 0.5, 1.0, 0.0),
            })
            .collect()
    }

    struct Fixture {
        samples: Vec<ReferenceLapSample>,
        targets: Vec<CornerTarget>,
    }

    fn fixture() -> Fixture {
        let samples = corner_samples();
        let targets = extract_corner_targets(&samples, TRACK_LENGTH_M);

        Fixture { samples, targets }
    }

    impl Fixture {
        /// The speed-based cases run with the exit calls off, as they were written;
        /// the corner-exit block turns them on.
        fn input(&self, current_speed: f32, current_dist_pct: f32) -> AdvisoryInput<'_> {
            AdvisoryInput {
                current_speed,
                current_throttle: 1.0,
                current_brake: 0.0,
                current_dist_pct,
                track_length_m: TRACK_LENGTH_M,
                corner_targets: &self.targets,
                reference_samples: &self.samples,
                target_speed_profile: None,
                brake_abs_active: false,
                current_steering_wheel_angle: 0.0,
                current_lat_accel: None,
                current_long_accel: None,
                steering_unsettled: false,
                corner_exit_calls_enabled: false,
            }
        }

        fn exit_input(&self, current_dist_pct: f32) -> AdvisoryInput<'_> {
            AdvisoryInput {
                corner_exit_calls_enabled: true,
                current_throttle: 0.0,
                ..self.input(20.0, current_dist_pct)
            }
        }
    }

    fn advise(input: &AdvisoryInput) -> AdvisoryState {
        compute_driving_advisory(input, &NEUTRAL_ADVISORY_STATE)
    }

    fn assert_close(actual: f32, expected: f32, tolerance: f32) {
        assert!(
            (actual - expected).abs() <= tolerance,
            "{actual} is not within {tolerance} of {expected}"
        );
    }

    #[test]
    fn interpolates_linearly_between_bucket_centres() {
        let samples: Vec<_> = [10.0, 20.0, 30.0, 40.0]
            .map(|speed| plain(speed, 0.0, 0.0))
            .into();

        // pct 0.25 → x = 0.5 → halfway between buckets 0 and 1.
        assert_close(
            interpolate_reference_sample(&samples, 0.25).unwrap().speed,
            15.0,
            1e-4,
        );
        // pct 0 → x = -0.5 → halfway between the last and the first.
        assert_close(
            interpolate_reference_sample(&samples, 0.0).unwrap().speed,
            25.0,
            1e-4,
        );
    }

    #[test]
    fn finds_the_single_apex_with_a_positive_deceleration() {
        let targets = fixture().targets;

        assert_eq!(targets.len(), 1);
        assert_close(targets[0].target_speed, 10.0, 0.5);
        assert!(targets[0].braking_decel > 0.0);
    }

    #[test]
    fn records_the_corner_exit() {
        let target = fixture().targets[0];

        assert_close(target.throttle_open_pct.unwrap(), 0.46, 0.005);
        assert_close(target.exit_end_pct.unwrap(), 0.56, 0.005);
    }

    #[test]
    fn records_where_the_reference_first_braked() {
        assert_close(fixture().targets[0].brake_start_pct, 0.4, 0.005);
    }

    #[test]
    fn ignores_noise_below_the_speed_drop_threshold() {
        let mut samples = vec![plain(60.0, 1.0, 0.0); BUCKET_COUNT];
        samples[500] = plain(59.7, 1.0, 0.0);

        assert!(extract_corner_targets(&samples, TRACK_LENGTH_M).is_empty());
    }

    #[test]
    fn finds_the_nearest_target_ahead_and_nothing_just_past_it() {
        let targets = fixture().targets;

        let ahead = find_next_corner_target(&targets, 0.3, TRACK_LENGTH_M).unwrap();
        assert_close(ahead.dist_pct, targets[0].dist_pct, 0.005);
        assert!(find_next_corner_target(&targets, 0.46, TRACK_LENGTH_M).is_none());
    }

    #[test]
    fn derives_the_physics_target_from_curvature_and_grip() {
        // κ = 8/20² (grip-limited: the reference speed) and κ = 2/20² (√(8/0.005) = 40).
        let samples: Vec<_> = (0..BUCKET_COUNT)
            .map(|index| sample(20.0, 0.5, 0.0, Some(if index < 500 { 8.0 } else { 2.0 })))
            .collect();
        let profile = build_target_speed_profile(&samples).unwrap();

        assert_close(profile[100].unwrap(), 20.0, 0.05);
        assert_close(profile[700].unwrap(), 40.0, 0.05);
    }

    #[test]
    fn leaves_straights_free_and_rejects_laps_without_lateral_data() {
        let straight = vec![sample(50.0, 1.0, 0.0, Some(0.1)); BUCKET_COUNT];
        let no_lateral = vec![sample(50.0, 1.0, 0.0, None); BUCKET_COUNT];

        assert!(build_target_speed_profile(&straight)
            .unwrap()
            .iter()
            .all(Option::is_none));
        assert!(build_target_speed_profile(&no_lateral).is_none());
    }

    #[test]
    fn calls_brake_when_the_speed_cannot_be_shed_in_time() {
        let fixture = fixture();
        let state = advise(&fixture.input(60.0, 0.44));

        assert_eq!(state.advisory, DrivingAdvisory::Brake);
        assert_close(
            state.brake_corner_pct.unwrap(),
            fixture.targets[0].dist_pct,
            1e-5,
        );
        assert_eq!(state.brake_urgency, 1.0);
    }

    #[test]
    fn calls_brake_inside_the_reference_braking_zone_while_above_apex_speed() {
        let fixture = fixture();

        assert_eq!(
            advise(&fixture.input(45.0, 0.405)).advisory,
            DrivingAdvisory::Brake
        );
    }

    #[test]
    fn holds_the_brake_latch_until_the_target_speed_is_reached() {
        let fixture = fixture();
        let latched = advise(&fixture.input(60.0, 0.44));
        let still_braking = compute_driving_advisory(
            &AdvisoryInput {
                current_throttle: 0.0,
                current_brake: 0.9,
                ..fixture.input(25.0, 0.45)
            },
            &latched,
        );

        assert_eq!(still_braking.advisory, DrivingAdvisory::Brake);

        let released = compute_driving_advisory(
            &AdvisoryInput {
                current_throttle: 0.0,
                ..fixture.input(10.0, 0.452)
            },
            &still_braking,
        );

        assert_eq!(released.advisory, DrivingAdvisory::Neutral);
    }

    #[test]
    fn stays_neutral_at_reference_pace_on_the_straight() {
        assert_eq!(
            advise(&fixture().input(59.0, 0.2)).advisory,
            DrivingAdvisory::Neutral
        );
    }

    #[test]
    fn reports_partial_urgency_on_the_approach() {
        let state = advise(&fixture().input(59.0, 0.2));

        assert!(state.brake_urgency > 0.0 && state.brake_urgency < 1.0);
    }

    #[test]
    fn calls_brake_on_mid_corner_overspeed_against_the_profile() {
        let fixture = fixture();
        let mut profile = vec![None; BUCKET_COUNT];
        profile[200] = Some(30.0);

        let state = advise(&AdvisoryInput {
            target_speed_profile: Some(&profile),
            ..fixture.input(40.0, 0.2005)
        });

        assert_eq!(state.advisory, DrivingAdvisory::Brake);
    }

    #[test]
    fn calls_brake_on_under_braking_without_a_detected_corner() {
        let fixture = fixture();
        let state = advise(&AdvisoryInput {
            corner_targets: &[],
            current_brake: 0.1,
            ..fixture.input(45.0, 0.422)
        });

        assert_eq!(state.advisory, DrivingAdvisory::Brake);
    }

    #[test]
    fn calls_gas_well_under_the_reference_on_a_flat_out_straight() {
        let fixture = fixture();
        let state = advise(&AdvisoryInput {
            current_throttle: 0.5,
            ..fixture.input(50.0, 0.1)
        });

        assert_eq!(state.advisory, DrivingAdvisory::Gas);
    }

    #[test]
    fn holds_the_gas_latch_while_closing_and_releases_once_closed() {
        let fixture = fixture();
        let latched = advise(&AdvisoryInput {
            current_throttle: 0.5,
            ..fixture.input(50.0, 0.1)
        });
        let still_closing = compute_driving_advisory(
            &AdvisoryInput {
                current_throttle: 0.9,
                ..fixture.input(59.0, 0.15)
            },
            &latched,
        );

        assert_eq!(still_closing.advisory, DrivingAdvisory::Gas);

        let closed = compute_driving_advisory(&fixture.input(59.8, 0.2), &still_closing);

        assert_eq!(closed.advisory, DrivingAdvisory::Neutral);
    }

    #[test]
    fn calls_gas_on_grip_headroom_when_the_reference_is_not_flat_out() {
        let fixture = fixture();
        let grip_samples = vec![sample(30.0, 0.6, 0.0, Some(8.0)); BUCKET_COUNT];
        let state = advise(&AdvisoryInput {
            reference_samples: &grip_samples,
            corner_targets: &[],
            current_throttle: 0.4,
            current_lat_accel: Some(5.0),
            current_long_accel: Some(0.0),
            ..fixture.input(27.0, 0.5)
        });

        assert_eq!(state.advisory, DrivingAdvisory::Gas);
    }

    #[test]
    fn suppresses_the_brake_call_while_abs_is_active() {
        let fixture = fixture();
        let state = advise(&AdvisoryInput {
            brake_abs_active: true,
            ..fixture.input(60.0, 0.44)
        });

        assert_eq!(state.advisory, DrivingAdvisory::Neutral);
    }

    #[test]
    fn still_calls_brake_on_a_diverging_line() {
        let fixture = fixture();
        let state = advise(&AdvisoryInput {
            current_steering_wheel_angle: 1.2,
            ..fixture.input(60.0, 0.44)
        });

        assert_eq!(state.advisory, DrivingAdvisory::Brake);
    }

    #[test]
    fn suppresses_gas_when_the_steering_diverges() {
        let fixture = fixture();
        let state = advise(&AdvisoryInput {
            current_steering_wheel_angle: 1.2,
            current_throttle: 0.5,
            ..fixture.input(50.0, 0.1)
        });

        assert_eq!(state.advisory, DrivingAdvisory::Neutral);
    }

    #[test]
    fn suppresses_gas_when_the_lateral_load_diverges() {
        let fixture = fixture();
        let state = advise(&AdvisoryInput {
            current_lat_accel: Some(12.0),
            current_throttle: 0.5,
            ..fixture.input(50.0, 0.1)
        });

        assert_eq!(state.advisory, DrivingAdvisory::Neutral);
    }

    #[test]
    fn calls_gas_while_off_the_power_past_the_reference_opening() {
        let fixture = fixture();
        let state = advise(&fixture.exit_input(0.48));

        assert_eq!(state.advisory, DrivingAdvisory::Gas);
        assert_close(state.exit_late_m.unwrap(), 20.0, 0.5);
        assert_close(state.exit_corner_pct.unwrap(), 0.45, 0.005);
    }

    #[test]
    fn stays_quiet_within_the_call_threshold_of_the_reference_opening() {
        assert_eq!(
            advise(&fixture().exit_input(0.462)).advisory,
            DrivingAdvisory::Neutral
        );
    }

    #[test]
    fn freezes_the_figure_where_the_throttle_was_opened() {
        let fixture = fixture();
        let opened = advise(&AdvisoryInput {
            current_throttle: 1.0,
            ..fixture.exit_input(0.48)
        });

        assert_close(opened.exit_throttle_open_pct.unwrap(), 0.48, 5e-4);

        let later = compute_driving_advisory(
            &AdvisoryInput {
                current_throttle: 1.0,
                ..fixture.exit_input(0.52)
            },
            &opened,
        );

        assert_close(later.exit_late_m.unwrap(), 20.0, 0.5);
    }

    #[test]
    fn calls_gas_on_a_pedal_deficit_once_on_the_power() {
        let fixture = fixture();
        let state = compute_driving_advisory(
            &AdvisoryInput {
                current_throttle: 0.5,
                ..fixture.exit_input(0.5)
            },
            &AdvisoryState {
                exit_corner_pct: Some(fixture.targets[0].dist_pct),
                exit_throttle_open_pct: Some(0.46),
                ..NEUTRAL_ADVISORY_STATE
            },
        );

        assert_eq!(state.advisory, DrivingAdvisory::Gas);
        assert!(state.exit_late_m.is_none());
        assert_close(state.exit_throttle_deficit, 0.5, 0.005);
    }

    #[test]
    fn reports_grip_while_the_car_is_corrected() {
        let fixture = fixture();
        let state = advise(&AdvisoryInput {
            steering_unsettled: true,
            ..fixture.exit_input(0.48)
        });

        assert_eq!(state.advisory, DrivingAdvisory::Grip);
    }

    #[test]
    fn keeps_no_exit_bookkeeping_with_the_calls_off() {
        let fixture = fixture();
        let state = advise(&AdvisoryInput {
            corner_exit_calls_enabled: false,
            ..fixture.exit_input(0.48)
        });

        assert_eq!(state.advisory, DrivingAdvisory::Neutral);
        assert!(state.exit_late_m.is_none());
        assert!(state.exit_corner_pct.is_none());
    }

    #[test]
    fn starts_clean_at_the_next_corner() {
        let fixture = fixture();
        let state = compute_driving_advisory(
            &fixture.exit_input(0.48),
            &AdvisoryState {
                exit_corner_pct: Some(0.9),
                exit_throttle_open_pct: Some(0.91),
                ..NEUTRAL_ADVISORY_STATE
            },
        );

        assert_close(state.exit_corner_pct.unwrap(), 0.45, 0.005);
        assert!(state.exit_throttle_open_pct.is_none());
    }

    #[test]
    fn flags_repeated_corrections_and_ignores_a_smooth_arc() {
        let sawtooth = [0.0, 0.1, 0.0, 0.1, 0.0, 0.1, 0.0];
        let arc = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
        let noise = [0.0, 0.005, 0.0, 0.005, 0.0, 0.005, 0.0];

        assert!(is_steering_unsettled(&sawtooth));
        assert!(!is_steering_unsettled(&arc));
        assert!(!is_steering_unsettled(&noise));
    }
}
