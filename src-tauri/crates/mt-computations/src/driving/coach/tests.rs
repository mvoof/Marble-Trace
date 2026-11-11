use super::*;
use std::collections::HashMap;

use crate::strategy::fuel::FuelSettings;
use mt_model::sim::cars::{CarIdxFrame, PacingFrame};
use mt_model::sim::environment::EnvironmentFrame;
use mt_model::sim::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame, PitServiceFrame,
};
use mt_model::sim::session::SessionSnapshot;

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
        time_into_lap: None,
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

fn compute_at(processor: &mut CoachProcessor, lap_dist_pct: Option<f32>) -> CoachFrame {
    let session = SessionSnapshot::default();
    let start_positions = HashMap::new();
    let lap_timing = LapTimingFrame {
        lap_dist_pct,
        ..LapTimingFrame::default()
    };
    let ctx = ComputeContext {
        car_dynamics: &CarDynamicsFrame::default(),
        car_inputs: &CarInputsFrame::default(),
        car_idx: &CarIdxFrame::default(),
        pacing: &PacingFrame::default(),
        lap_timing: &lap_timing,
        car_status: &CarStatusFrame::default(),
        pit_service: &PitServiceFrame::default(),
        chassis: &ChassisFrame::default(),
        environment: &EnvironmentFrame::default(),
        session: &session,
        track_length_m: 0.0,
        car_length_m: 0.0,
        start_positions: &start_positions,
        fuel_settings: FuelSettings::default(),
        lap_delta_active: false,
        session_num: None,
        session_time: None,
        session_time_remain: None,
        session_state: None,
        session_flags: None,
    };

    match processor.compute(&ctx) {
        Some(ComputedOutput::Coach(frame)) => frame,
        other => panic!("expected a coach frame, got {other:?}"),
    }
}

// The widget records its own trace with no reference lap at all, so the
// position has to arrive while the coach itself is idle.
#[test]
fn an_idle_coach_still_reports_the_position() {
    let mut processor = CoachProcessor::default();
    let frame = compute_at(&mut processor, Some(0.25));

    assert_eq!(
        frame.inactive_reason,
        Some(CoachInactiveReason::NoReference)
    );
    assert_eq!(frame.lap_dist_pct, Some(0.25));
}

#[test]
fn a_position_the_sim_marks_invalid_is_not_reported() {
    let mut processor = CoachProcessor::default();

    assert_eq!(compute_at(&mut processor, Some(-1.0)).lap_dist_pct, None);
    assert_eq!(compute_at(&mut processor, None).lap_dist_pct, None);
}
