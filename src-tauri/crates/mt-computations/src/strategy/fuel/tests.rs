use std::time::Duration;

use super::*;
use mt_model::sim::player::{CarStatusFrame, LapTimingFrame};

fn make_car_status(fuel_level: f32) -> CarStatusFrame {
    CarStatusFrame {
        fuel_level,
        fuel_level_pct: None,
        fuel_use_per_hour: None,
        oil_temp: None,
        oil_press: None,
        water_temp: None,
        voltage: None,
        on_pit_road: None,
        is_on_track: None,
        spotter: None,
        engine_warnings: None,
        player_car_sl_shift_rpm: vec![],
        player_car_sl_blink_rpm: vec![],
        flags: Default::default(),
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

fn make_lap_timing(lap: Option<i32>, lap_dist_pct: Option<f32>) -> LapTimingFrame {
    LapTimingFrame {
        lap,
        lap_dist: None,
        lap_dist_pct,
        lap_current_lap_time: 0.0,
        lap_last_lap_time: None,
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

#[test]
fn test_compute_empty_history() {
    let car_status = make_car_status(50.0);
    let lap_timing = make_lap_timing(None, None);
    let session = SessionSnapshot::default();
    let fuel_state = FuelState::default();

    let result = compute(
        &car_status,
        &lap_timing,
        &session,
        None,
        None,
        FuelSettings::default(),
        &fuel_state,
    );

    assert_eq!(result.avg_per_lap, None);
    assert_eq!(result.laps_remaining, None);
    assert_eq!(result.laps_to_finish, None);
    assert_eq!(result.shortage, None);
    assert_eq!(result.fuel_to_add, None);
    assert_eq!(result.fuel_to_add_with_buffer, None);
    assert_eq!(result.fuel_save_per_lap, None);
    assert!(!result.pit_warning);
    assert_eq!(result.pit_window_start, None);
    assert_eq!(result.pit_window_end, None);
    assert!(result.is_timed_race);
    assert!(result.lap_fuel_history.is_empty());
}

#[test]
fn test_compute_with_history() {
    let car_status = make_car_status(50.0);
    let lap_timing = make_lap_timing(Some(5), None);
    let session = SessionSnapshot::default();
    let fuel_state = FuelState {
        lap_fuel_history: counted_history(&[2.0, 2.0, 2.0]),
        ..Default::default()
    };

    let result = compute(
        &car_status,
        &lap_timing,
        &session,
        None,
        None,
        FuelSettings::default(),
        &fuel_state,
    );

    assert_eq!(result.avg_per_lap, Some(2.0));
    assert_eq!(result.laps_remaining, Some(25.0)); // 50.0 / 2.0
}

/// 3.6L at 2.0L/lap = 1.8 laps of fuel left, on lap 17.
fn compute_window(lap_dist_pct: Option<f32>, pit_warning_laps: f32) -> (Option<i32>, Option<i32>) {
    let car_status = make_car_status(3.6);
    let lap_timing = make_lap_timing(Some(17), lap_dist_pct);
    let session = SessionSnapshot::default();
    let fuel_state = FuelState {
        lap_fuel_history: counted_history(&[2.0, 2.0, 2.0]),
        ..Default::default()
    };

    let result = compute(
        &car_status,
        &lap_timing,
        &session,
        None,
        None,
        FuelSettings {
            pit_warning_laps,
            ..Default::default()
        },
        &fuel_state,
    );

    (result.pit_window_start, result.pit_window_end)
}

#[test]
fn test_pit_window_counts_from_the_car_position() {
    // 40% into lap 17 with 1.8 laps of fuel runs the tank dry 20% into
    // lap 19, so the window covers 16 through 18. Reading the lap counter
    // alone would place it a lap early, at 15 through 17.
    assert_eq!(
        compute_window(Some(0.4), DEFAULT_PIT_WARNING_LAPS),
        (Some(16), Some(18))
    );
}

#[test]
fn test_pit_window_falls_back_to_the_lap_line() {
    // No distance reading: the car is treated as sitting on the line it
    // last crossed, which is where the lap counter puts it.
    assert_eq!(
        compute_window(None, DEFAULT_PIT_WARNING_LAPS),
        (Some(15), Some(17))
    );
}

#[test]
fn test_pit_window_never_closes_before_it_opens() {
    // A warning margin under the closing cushion would invert the range:
    // opening on 19, closing on 18.
    assert_eq!(compute_window(Some(0.4), 0.1), (Some(19), Some(19)));
}

#[test]
fn test_avg_window_uses_most_recent_laps() {
    let state = FuelState {
        lap_fuel_history: counted_history(&[4.0, 4.0, 4.0, 2.0, 2.0]),
        ..Default::default()
    };

    // Window 0 averages everything: (4+4+4+2+2) / 5
    assert_eq!(state.avg(0), Some(3.2));

    // A short window only sees the recent, cheaper laps.
    assert_eq!(state.avg(2), Some(2.0));

    // A window longer than the history falls back to the full history.
    assert_eq!(state.avg(50), Some(3.2));
}

#[test]
fn test_avg_window_changes_laps_remaining() {
    let car_status = make_car_status(20.0);
    let lap_timing = make_lap_timing(Some(5), None);
    let session = SessionSnapshot::default();
    let fuel_state = FuelState {
        lap_fuel_history: counted_history(&[4.0, 4.0, 4.0, 2.0, 2.0]),
        ..Default::default()
    };

    let windowed = compute(
        &car_status,
        &lap_timing,
        &session,
        None,
        None,
        FuelSettings {
            avg_window: 2,
            ..Default::default()
        },
        &fuel_state,
    );

    assert_eq!(windowed.avg_per_lap, Some(2.0));
    assert_eq!(windowed.laps_remaining, Some(10.0)); // 20.0 / 2.0
}

fn green(lap: i32, fuel_level: f32) -> FuelSample {
    FuelSample {
        lap,
        fuel_level,
        session_num: 1,
        on_track: true,
        caution: false,
    }
}

/// Seeds a history of laps that all count, as a stint of green laps leaves.
fn counted_history(used: &[f32]) -> Vec<FuelLapRecord> {
    used.iter()
        .enumerate()
        .map(|(index, &used)| FuelLapRecord {
            lap: index as i32 + 1,
            used,
            rejected: None,
        })
        .collect()
}

/// Why each recorded lap was rejected, in order — `None` where it counted.
fn rejections(state: &FuelState) -> Vec<Option<&str>> {
    state
        .lap_fuel_history
        .iter()
        .map(|record| record.rejected.as_deref())
        .collect()
}

/// Feeds a sample as if a full-length lap had elapsed since the last one.
/// The state clock only exists to catch counter jumps no lap could have
/// produced, and a test runs far faster than any lap.
fn drive(state: &mut FuelState, sample: FuelSample) {
    state.lap_started_at = state
        .lap_started_at
        .map(|at| at - Duration::from_secs_f64(MIN_LAP_SECS * 2.0));

    state.update(sample);
}

#[test]
fn test_fuel_state_updates_ignoring_lap_zero() {
    let mut state = FuelState::default();

    drive(&mut state, green(0, 50.0));
    assert_eq!(state.last_lap, 0);
    assert_eq!(state.last_lap_start_fuel, Some(50.0));
    assert!(state.lap_fuel_history.is_empty());

    // Same lap: the opening reading stands.
    drive(&mut state, green(0, 49.5));
    assert_eq!(state.last_lap_start_fuel, Some(50.0));
    assert!(state.lap_fuel_history.is_empty());

    // Lap 0 completed — the lap out of the garage tells nothing about pace,
    // but it is still recorded so the chart can show it greyed out.
    drive(&mut state, green(1, 48.0));
    assert_eq!(state.last_lap, 1);
    assert_eq!(rejections(&state), vec![Some("out-lap")]);
    assert!(state.counted_laps().is_empty());

    // Lap 1 completed on 2.5L, the first lap worth counting.
    drive(&mut state, green(2, 45.5));
    assert_eq!(state.counted_laps(), vec![2.5]);
    assert_eq!(state.lap_fuel_history[1].lap, 1);
}

#[test]
fn test_refuelled_lap_is_still_recorded() {
    let mut state = FuelState::default();

    drive(&mut state, green(4, 20.0));

    // Burns 2L, takes on 30L in the pits, then trickles to the line.
    drive(&mut state, green(4, 18.0));
    drive(&mut state, green(4, 48.0));
    drive(&mut state, green(4, 47.5));

    drive(&mut state, green(5, 47.5));

    // 20 burned down to 47.5 having gained 30 — the stop is not fuel saved.
    assert_eq!(state.counted_laps(), vec![2.5]);
}

#[test]
fn test_caution_lap_is_dropped() {
    let mut state = FuelState::default();

    drive(&mut state, green(4, 20.0));
    drive(
        &mut state,
        FuelSample {
            caution: true,
            ..green(4, 19.0)
        },
    );
    drive(&mut state, green(5, 18.5));

    assert!(state.counted_laps().is_empty());
    assert_eq!(rejections(&state), vec![Some("caution")]);
}

#[test]
fn test_off_track_lap_is_dropped() {
    let mut state = FuelState::default();

    drive(&mut state, green(4, 20.0));
    drive(
        &mut state,
        FuelSample {
            on_track: false,
            ..green(4, 19.0)
        },
    );
    drive(&mut state, green(5, 17.5));

    assert!(state.counted_laps().is_empty());
    assert_eq!(rejections(&state), vec![Some("left-track")]);
}

#[test]
fn test_counter_jump_without_a_lap_is_dropped() {
    let mut state = FuelState::default();

    drive(&mut state, green(4, 20.0));
    // No back-dating: the counter advanced with no time for a lap to pass.
    state.update(green(5, 17.5));

    assert!(state.counted_laps().is_empty());
    assert_eq!(rejections(&state), vec![Some("too-short")]);
}

#[test]
fn test_outlier_lap_is_dropped_but_a_normal_one_is_kept() {
    // Same session number the samples carry, or the first one would be
    // read as a session change and wipe the seeded history.
    let mut state = FuelState {
        lap_fuel_history: counted_history(&[2.5, 2.5, 2.5]),
        tracked_session_num: 1,
        ..Default::default()
    };

    drive(&mut state, green(4, 20.0));
    drive(&mut state, green(5, 15.0)); // 5.0L — double the stint's pace
    assert_eq!(state.counted_laps(), vec![2.5, 2.5, 2.5]);
    // Kept on record with its reason rather than erased from the chart.
    assert_eq!(
        state.lap_fuel_history[3].rejected.as_deref(),
        Some("outlier")
    );
    assert_eq!(state.lap_fuel_history[3].lap, 4);

    drive(&mut state, green(6, 12.4)); // 2.6L — ordinary variation
    let counted = state.counted_laps();
    assert_eq!(counted.len(), 4);
    assert!((counted[3] - 2.6).abs() < 0.001);
}

#[test]
fn test_outlier_needs_a_baseline_before_it_rejects_anything() {
    assert!(!is_outlier(9.0, &[]));
    assert!(!is_outlier(9.0, &[2.5, 2.5]));
    assert!(is_outlier(9.0, &[2.5, 2.5, 2.5]));
}

#[test]
fn test_outlier_keeps_laps_near_the_mean_when_the_spread_collapses() {
    // Identical laps give a zero interquartile range; without the mean
    // tolerance the fence would be a point and reject every next lap.
    assert!(!is_outlier(2.55, &[2.5, 2.5, 2.5, 2.5]));
}

fn record(lap: i32, used: f32, rejected: Option<&str>) -> FuelLapRecord {
    FuelLapRecord {
        lap,
        used,
        rejected: rejected.map(str::to_string),
    }
}

#[test]
fn history_stats_are_empty_without_a_counted_lap() {
    assert_eq!(history_stats(&[]), FuelHistoryStats::default());
    assert_eq!(
        history_stats(&[record(1, 9.0, Some("out-lap"))]),
        FuelHistoryStats::default(),
        "a rejected lap must not become the average"
    );
}

#[test]
fn history_stats_ignore_rejected_laps_for_every_figure() {
    let stats = history_stats(&[
        record(1, 9.0, Some("out-lap")),
        record(2, 2.0, None),
        record(3, 4.0, None),
        record(4, 3.0, None),
    ]);

    assert_eq!(stats.last, Some(3.0));
    assert_eq!(stats.min, Some(2.0));
    assert_eq!(stats.max, Some(4.0));
    assert_eq!(stats.avg, Some(3.0));
}

#[test]
fn a_single_tank_is_one_stop_for_the_whole_amount() {
    assert_eq!(
        refuel_plan(Some(42.6), Some(65.0), 0.0),
        Some(RefuelPlan {
            stops: 1,
            fill_now: 42.6
        })
    );
}

#[test]
fn more_than_a_tank_fills_to_the_brim_now() {
    assert_eq!(
        refuel_plan(Some(142.6), Some(65.0), 0.0),
        Some(RefuelPlan {
            stops: 3,
            fill_now: 65.0
        })
    );
}

#[test]
fn this_stop_is_capped_by_the_space_left_in_the_tank() {
    // 50 L on board of 65 leaves room for 15, so 30 L cannot be taken in
    // one go however much the strategy wants it — and the remainder is a
    // second stop the driver has to be told about.
    assert_eq!(
        refuel_plan(Some(30.0), Some(65.0), 50.0),
        Some(RefuelPlan {
            stops: 2,
            fill_now: 15.0
        })
    );
}

#[test]
fn a_partly_filled_tank_with_room_to_spare_is_still_one_stop() {
    assert_eq!(
        refuel_plan(Some(10.0), Some(65.0), 50.0),
        Some(RefuelPlan {
            stops: 1,
            fill_now: 10.0
        })
    );
}

#[test]
fn a_full_tank_that_still_wants_fuel_falls_back_to_the_capacity_cap() {
    assert_eq!(
        refuel_plan(Some(30.0), Some(65.0), 65.0),
        Some(RefuelPlan {
            stops: 1,
            fill_now: 30.0
        })
    );
}

#[test]
fn nothing_to_add_is_no_plan() {
    assert_eq!(refuel_plan(None, Some(65.0), 0.0), None);
    assert_eq!(refuel_plan(Some(0.0), Some(65.0), 0.0), None);
}

#[test]
fn an_unknown_capacity_still_names_the_total() {
    assert_eq!(
        refuel_plan(Some(42.6), None, 0.0),
        Some(RefuelPlan {
            stops: 1,
            fill_now: 42.6
        })
    );
}

fn resumed_with_laps(session_num: i32, laps: &[i32]) -> FuelState {
    let mut state = FuelState::default();

    state.resume(&FuelMemory {
        session_num,
        laps: laps
            .iter()
            .map(|lap| FuelLapRecord {
                lap: *lap,
                used: 2.0,
                rejected: None,
            })
            .collect(),
    });

    state
}

#[test]
fn resumed_history_waits_out_a_car_not_yet_in_the_world() {
    let mut state = resumed_with_laps(1, &[3, 4]);

    drive(&mut state, green(-1, 0.0));
    drive(&mut state, green(0, 0.0));

    assert_eq!(state.counted_laps(), vec![2.0, 2.0]);
}

#[test]
fn the_lap_a_restart_cut_into_is_not_measured() {
    let mut state = resumed_with_laps(1, &[3, 4]);

    drive(&mut state, green(5, 40.0));
    drive(&mut state, green(6, 39.5));
    assert_eq!(state.counted_laps(), vec![2.0, 2.0]);

    drive(&mut state, green(7, 37.5));
    assert_eq!(state.counted_laps(), vec![2.0, 2.0, 2.0]);
}

#[test]
fn a_lap_counter_behind_the_history_means_the_session_restarted() {
    let mut state = resumed_with_laps(1, &[3, 4]);

    drive(&mut state, green(2, 40.0));

    assert!(state.lap_fuel_history.is_empty());
}

#[test]
fn history_from_an_earlier_session_is_dropped() {
    let mut state = resumed_with_laps(0, &[3, 4]);

    drive(&mut state, green(5, 40.0));

    assert!(state.lap_fuel_history.is_empty());
}
