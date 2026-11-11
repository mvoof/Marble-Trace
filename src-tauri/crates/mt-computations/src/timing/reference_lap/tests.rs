use super::*;
use crate::timing::lap_time_settle::SETTLE_GRACE_S;
use mt_model::sim::cars::{CarIdxFrame, PaceFormation, PacingFrame};
use mt_model::sim::environment::EnvironmentFrame;
use mt_model::sim::flags::RaceFlags;

static NO_PACING: PacingFrame = PacingFrame {
    formation: PaceFormation::NotPacing,
    car_idx_pace_line: Vec::new(),
};
use mt_model::sim::player::{CarDynamicsFrame, CarInputsFrame, CarStatusFrame, LapTimingFrame};
use mt_model::sim::session::{CarEntry, SessionSnapshot};
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
    make_lap_timing_at(lap_dist_pct, last_lap_time, 0.0, None)
}

fn make_lap_timing_at(
    lap_dist_pct: f32,
    last_lap_time: Option<f32>,
    current_lap_time: f32,
    session_best: Option<f32>,
) -> LapTimingFrame {
    LapTimingFrame {
        lap: None,
        lap_dist: None,
        lap_dist_pct: Some(lap_dist_pct),
        lap_current_lap_time: current_lap_time,
        lap_best_lap_time: session_best,
        lap_last_lap_time: last_lap_time,
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
        spotter: None,
        engine_warnings: None,
        player_car_sl_shift_rpm: vec![],
        player_car_sl_blink_rpm: vec![],
        flags: RaceFlags::default(),
        dc_abs: None,
        dc_brake_bias: None,
        dc_traction_control: None,
        dc_throttle_shape: None,
        dc_traction_control_2: None,
        dc_engine_braking: None,
        dc_brake_bias_fine: None,
        dc_peak_brake_bias: None,
        dc_anti_roll_front: None,
        dc_anti_roll_rear: None,
        dc_brake_misc: None,
        dc_diff_entry: None,
        dc_diff_middle: None,
        dc_diff_exit: None,
        energy_ers_battery_pct: None,
        power_mgu_k: None,
        energy_battery_to_mgu_k_lap: None,
        dc_mguk_deploy_mode: None,
        drs: None,
        player_car_my_incident_count: None,
        player_car_team_incident_count: None,
    }
}

fn make_car_idx() -> CarIdxFrame {
    CarIdxFrame {
        car_idx_lap_dist_pct: vec![],
        car_idx_on_pit_road: vec![],
        car_idx_position: vec![],
        car_idx_class_position: vec![],
        car_idx_lap: vec![],
        car_idx_laps_completed: vec![],
        car_idx_last_lap_time: vec![],
        car_idx_best_lap_time: vec![],
        car_idx_f2_time: vec![],
        car_idx_est_time: vec![],
        car_idx_track_surface: vec![],
        car_idx_tire_compound: vec![],
        car_idx_session_flags: vec![],
        spotter: None,
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
        &EnvironmentFrame::default(),
    )
}

fn run_tick_in(
    proc: &mut ReferenceLapProcessor,
    session: &SessionSnapshot,
    lap_dist_pct: f32,
    last_lap_time: Option<f32>,
    environment: &EnvironmentFrame,
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

/// Runs a tick with an explicit `lap_current_lap_time` — how far into the
/// new lap the car is — and an explicit session best, which is what settles
/// a pending lap whose time reads the same as the previous lap's.
fn run_tick_at_lap_time(
    proc: &mut ReferenceLapProcessor,
    session: &SessionSnapshot,
    lap_dist_pct: f32,
    last_lap_time: Option<f32>,
    current_lap_time: f32,
    session_best: Option<f32>,
) -> Option<ComputedOutput> {
    let dynamics = make_dynamics(50.0);
    let inputs = make_inputs(1.0, 0.0);
    let lap_timing =
        make_lap_timing_at(lap_dist_pct, last_lap_time, current_lap_time, session_best);
    let car_status = make_car_status();
    let car_idx = make_car_idx();
    let start_pos = HashMap::new();
    let chassis = ChassisFrame::default();
    let environment = EnvironmentFrame::default();
    let ctx = make_ctx(MakeCtxArgs {
        dynamics: &dynamics,
        inputs: &inputs,
        lap_timing: &lap_timing,
        car_status: &car_status,
        session,
        car_idx: &car_idx,
        start_positions: &start_pos,
        chassis: &chassis,
        environment: &environment,
    });

    proc.compute(&ctx)
}

fn run_tick_at_speed(
    proc: &mut ReferenceLapProcessor,
    session: &SessionSnapshot,
    lap_dist_pct: f32,
    last_lap_time: Option<f32>,
    environment: &EnvironmentFrame,
    speed: f32,
) -> Option<ComputedOutput> {
    let dynamics = make_dynamics(speed);
    let inputs = make_inputs(1.0, 0.0);
    let lap_timing = make_lap_timing(lap_dist_pct, last_lap_time);
    let car_status = make_car_status();
    let car_idx = make_car_idx();
    let start_pos = HashMap::new();
    let chassis = ChassisFrame::default();
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
    cross_line_in(proc, session, lap_time, &EnvironmentFrame::default())
}

fn cross_line_in(
    proc: &mut ReferenceLapProcessor,
    session: &SessionSnapshot,
    lap_time: f32,
    environment: &EnvironmentFrame,
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
    chassis: &'a ChassisFrame,
    environment: &'a EnvironmentFrame,
}

fn make_ctx(args: MakeCtxArgs) -> ComputeContext {
    ComputeContext {
        car_dynamics: args.dynamics,
        car_inputs: args.inputs,
        car_idx: args.car_idx,
        pacing: &NO_PACING,
        lap_timing: args.lap_timing,
        car_status: args.car_status,
        pit_service: Box::leak(Box::default()),
        chassis: args.chassis,
        environment: args.environment,
        session: args.session,
        track_length_m: 3700.0,
        car_length_m: 4.4,
        start_positions: args.start_positions,
        fuel_settings: crate::strategy::fuel::FuelSettings::default(),
        lap_delta_active: false,
        session_num: Some(0),
        session_time: None,
        session_time_remain: None,
        session_state: None,
        session_flags: None,
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
    let dry = EnvironmentFrame::default();

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
    let chassis = ChassisFrame {
        lf_wear_l: Some(0.9),
        rf_wear_l: Some(0.7),
        ..Default::default()
    };
    let environment = EnvironmentFrame {
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
    let mut proc = ReferenceLapProcessor::default();
    proc.command(&ProcessorCommand::StoredReferenceTimes(
        StoredReferenceTimes {
            dry: Some(85.0),
            wet: None,
        },
    ));
    let session = make_session(1);
    let wet = EnvironmentFrame {
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

    let times = proc.stored_best_lap_time;
    assert_eq!(times.wet, Some(110.0));
    // The dry reference must be left exactly as it was.
    assert_eq!(times.dry, Some(85.0));
}

#[test]
fn a_lap_rained_on_part_way_through_counts_as_wet() {
    let mut proc = ReferenceLapProcessor::default();
    let session = make_session(1);
    let dry = EnvironmentFrame::default();
    let wet = EnvironmentFrame {
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
    let mut proc = ReferenceLapProcessor::default();
    proc.command(&ProcessorCommand::StoredReferenceTimes(
        StoredReferenceTimes {
            dry: Some(95.0),
            wet: None,
        },
    ));
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

    assert_eq!(proc.stored_best_lap_time.dry, Some(90.0));
}

#[test]
fn a_lap_the_sim_times_late_is_still_committed() {
    let mut proc = ReferenceLapProcessor::default();
    let session = make_session(1);

    drive_segment(&mut proc, &session, 0.005, 0.995);
    assert!(run_tick(&mut proc, &session, 0.05, None).is_none());

    // The sim takes its time. The lap stays parked instead of being timed
    // out — a personal best is not worth losing to a slow publish.
    for _ in 0..600 {
        assert!(run_tick(&mut proc, &session, 0.055, None).is_none());
    }

    assert!(run_tick(&mut proc, &session, 0.06, Some(90.0)).is_some());
}

#[test]
fn an_unresolved_lap_is_replaced_by_the_next_one() {
    let mut proc = ReferenceLapProcessor::default();
    let session = make_session(1);

    // First lap crosses the line and is never timed.
    drive_segment(&mut proc, &session, 0.005, 0.995);
    assert!(run_tick(&mut proc, &session, 0.05, None).is_none());

    // The next lap supersedes it, and the time that finally arrives belongs
    // to that lap, not to the one before it.
    drive_segment(&mut proc, &session, 0.06, 0.995);
    assert!(run_tick(&mut proc, &session, 0.05, None).is_none());

    match run_tick(&mut proc, &session, 0.055, Some(90.0)) {
        Some(ComputedOutput::ReferenceLap(data)) => assert_eq!(data.lap_time, 90.0),
        other => panic!("expected ReferenceLap output, got {other:?}"),
    }
}

/// The reported bug: the sim publishes a time equal to the previous lap's
/// reading, so the equality test alone never settles the lap and a genuine
/// personal best is silently lost. Past the grace window the reading is
/// taken once the session best moves to it, which is the sim confirming it
/// finished timing this lap.
#[test]
fn a_lap_timed_the_same_as_the_previous_reading_settles_after_the_grace_window() {
    let mut proc = ReferenceLapProcessor::default();
    proc.command(&ProcessorCommand::StoredReferenceTimes(
        StoredReferenceTimes {
            dry: Some(90.0),
            wet: None,
        },
    ));
    let session = make_session(1);

    // Mid-lap the sim reports 89.0 as the previous lap's time, with the
    // session best still standing at 91.0.
    let mut pct = 0.005;
    while pct < 0.995 {
        assert!(
            run_tick_at_lap_time(&mut proc, &session, pct, Some(89.0), 0.0, Some(91.0)).is_none()
        );
        pct += 0.005;
    }

    // The completed lap is timed 89.0 too, so the reading never differs
    // from the baseline. Inside the grace window it is still ambiguous.
    assert!(run_tick_at_lap_time(&mut proc, &session, 0.05, Some(89.0), 0.1, Some(91.0)).is_none());

    // The best moves to 89.0: the sim has published for this lap.
    let out = run_tick_at_lap_time(
        &mut proc,
        &session,
        0.055,
        Some(89.0),
        SETTLE_GRACE_S,
        Some(89.0),
    );

    match out {
        Some(ComputedOutput::ReferenceLap(data)) => assert_eq!(data.lap_time, 89.0),
        other => panic!("expected ReferenceLap output, got {other:?}"),
    }

    assert_eq!(proc.stored_best_lap_time.dry, Some(89.0));
}

/// A best that already stood at the reading confirms nothing: the previous
/// lap was the session best, so last and best both sit on its time and that
/// is exactly what a sim which has published nothing since looks like.
#[test]
fn a_best_that_already_stood_at_the_reading_does_not_settle_the_lap() {
    let mut proc = ReferenceLapProcessor::default();
    proc.command(&ProcessorCommand::StoredReferenceTimes(
        StoredReferenceTimes {
            dry: Some(90.0),
            wet: None,
        },
    ));
    let session = make_session(1);

    // The previous lap was 89.0 and was the session best, so both fields
    // read 89.0 for the whole lap in progress.
    let mut pct = 0.005;
    while pct < 0.995 {
        assert!(
            run_tick_at_lap_time(&mut proc, &session, pct, Some(89.0), 0.0, Some(89.0)).is_none()
        );
        pct += 0.005;
    }

    // Nothing the sim reports changes across the crossing, and the grace
    // window passing does not make the stale reading any more this lap's.
    assert!(run_tick_at_lap_time(&mut proc, &session, 0.05, Some(89.0), 0.1, Some(89.0)).is_none());
    assert!(run_tick_at_lap_time(
        &mut proc,
        &session,
        0.055,
        Some(89.0),
        SETTLE_GRACE_S,
        Some(89.0)
    )
    .is_none());
    assert!(run_tick_at_lap_time(
        &mut proc,
        &session,
        0.06,
        Some(89.0),
        SETTLE_GRACE_S * 5.0,
        Some(89.0)
    )
    .is_none());

    assert_eq!(proc.stored_best_lap_time.dry, Some(90.0));
}

/// The other side of the same reading: the sim is late, so what stands is
/// still the previous lap's time. Committing it would file the lap just
/// driven under a time it did not set, so the lap stays parked instead.
#[test]
fn an_ambiguous_reading_the_session_best_denies_is_not_committed() {
    let mut proc = ReferenceLapProcessor::default();
    proc.command(&ProcessorCommand::StoredReferenceTimes(
        StoredReferenceTimes {
            dry: Some(90.0),
            wet: None,
        },
    ));
    let session = make_session(1);

    let mut pct = 0.005;
    while pct < 0.995 {
        assert!(run_tick(&mut proc, &session, pct, Some(89.0)).is_none());
        pct += 0.005;
    }

    // 89.0 still stands, but the sim's best is 87.0 — it has not registered
    // a lap at 89.0 for this crossing, so the reading proves nothing.
    assert!(run_tick_at_lap_time(
        &mut proc,
        &session,
        0.05,
        Some(89.0),
        SETTLE_GRACE_S,
        Some(87.0)
    )
    .is_none());

    assert_eq!(proc.stored_best_lap_time.dry, Some(90.0));
}

#[test]
fn cleared_stored_reference_allows_recommit() {
    let mut proc = ReferenceLapProcessor::default();
    proc.command(&ProcessorCommand::StoredReferenceTimes(
        StoredReferenceTimes::default(),
    ));
    let session = make_session(1);

    drive_segment(&mut proc, &session, 0.005, 0.995);
    assert!(cross_line(&mut proc, &session, 90.0).is_some());
    assert_eq!(proc.stored_best_lap_time.dry, Some(90.0));
}

#[test]
fn track_change_resets_prior_best() {
    let mut proc = ReferenceLapProcessor::default();
    proc.command(&ProcessorCommand::StoredReferenceTimes(
        StoredReferenceTimes::default(),
    ));

    let session1 = make_session(1);
    drive_segment(&mut proc, &session1, 0.005, 0.995);
    assert!(cross_line(&mut proc, &session1, 90.0).is_some());

    // Switch tracks — a slower time than the old best should still count as
    // new best. The runtime refreshes the shared stored time on the
    // session-info update that changes the track; mimic finding no file.
    proc.command(&ProcessorCommand::StoredReferenceTimes(
        StoredReferenceTimes::default(),
    ));
    let session2 = make_session(2);
    drive_segment(&mut proc, &session2, 0.005, 0.995);
    assert!(cross_line(&mut proc, &session2, 95.0).is_some());
}

/// One tick at `session_time` on the sim's clock.
fn run_timed_tick(
    proc: &mut ReferenceLapProcessor,
    session: &SessionSnapshot,
    lap_dist_pct: f32,
    session_time: f64,
    speed: f32,
    last_lap_time: Option<f32>,
) -> Option<ComputedOutput> {
    let dynamics = make_dynamics(speed);
    let inputs = make_inputs(1.0, 0.0);
    let lap_timing = make_lap_timing(lap_dist_pct, last_lap_time);
    let car_status = make_car_status();
    let car_idx = make_car_idx();
    let start_pos = HashMap::new();
    let chassis = ChassisFrame::default();
    let environment = EnvironmentFrame::default();
    let mut ctx = make_ctx(MakeCtxArgs {
        dynamics: &dynamics,
        inputs: &inputs,
        lap_timing: &lap_timing,
        car_status: &car_status,
        session,
        car_idx: &car_idx,
        start_positions: &start_pos,
        chassis: &chassis,
        environment: &environment,
    });
    ctx.session_time = Some(session_time);

    proc.compute(&ctx)
}

/// A lap of `LAP_S` seconds at a steady pace, ticked at 30 Hz from
/// `from_s` to `to_s` on a clock that started at the line at `0.0`;
/// returns the first output.
fn drive_timed(
    proc: &mut ReferenceLapProcessor,
    session: &SessionSnapshot,
    (from_s, to_s): (f64, f64),
    last_lap_time: Option<f32>,
) -> Option<ComputedOutput> {
    const LAP_S: f64 = 100.0;
    const TICK_S: f64 = 1.0 / 30.0;
    // Off the bucket grid, so no tick lands on a bucket centre.
    const OFFSET_S: f64 = 0.0123;

    let mut tick = (from_s / TICK_S).ceil() as i64;

    loop {
        let at = tick as f64 * TICK_S + OFFSET_S;

        if at > to_s {
            return None;
        }

        let pct = (at / LAP_S).rem_euclid(1.0) as f32;
        // A lap time is far longer than the session clock here; offset it
        // so the clock reads like a session already under way.
        let output = run_timed_tick(proc, session, pct, 1000.0 + at, 37.0, last_lap_time);

        if output.is_some() {
            return output;
        }

        tick += 1;
    }
}

// Integrated from speed, the time between two points carried the error of
// every bucket on the way; stamped off the clock it is what it was.
#[test]
fn each_bucket_carries_the_time_the_car_passed_its_centre() {
    let mut proc = ReferenceLapProcessor::default();
    let session = make_session(1);

    // Joined before the line, then a full lap and a little more until the
    // sim publishes its time.
    assert!(drive_timed(&mut proc, &session, (-5.0, 100.5), None).is_none());

    match drive_timed(&mut proc, &session, (100.5, 102.0), Some(100.0)) {
        Some(ComputedOutput::ReferenceLap(data)) => {
            for bucket in [0, 1, 500, 998, 999] {
                let expected = (bucket as f32 + 0.5) / 10.0;
                let time = data.samples[bucket].time_into_lap.expect("timed");

                assert!(
                    (time - expected).abs() < 1e-3,
                    "bucket {bucket}: {time} against {expected}"
                );
            }

            assert!(data.samples.iter().all(|sample| sample.speed == 37.0));
        }
        other => panic!("expected ReferenceLap output, got {other:?}"),
    }
}

#[test]
fn a_lap_joined_part_way_has_no_clock() {
    let mut proc = ReferenceLapProcessor::default();
    let session = make_session(1);

    drive_timed(&mut proc, &session, (30.0, 60.0), None);

    assert_eq!(proc.working[400].time_into_lap, None);
}

// The flat fill moved every skipped bucket to where the car was a tick later.
#[test]
fn skipped_buckets_run_along_the_line_between_two_ticks() {
    let mut proc = ReferenceLapProcessor::default();
    let session = make_session(1);
    let dry = EnvironmentFrame::default();

    run_tick_at_speed(&mut proc, &session, 0.1005, None, &dry, 10.0);
    run_tick_at_speed(&mut proc, &session, 0.1045, None, &dry, 30.0);

    let speeds: Vec<f32> = (101..=104)
        .map(|bucket| proc.working[bucket].speed)
        .collect();

    assert_eq!(speeds, vec![15.0, 20.0, 25.0, 30.0]);
}
