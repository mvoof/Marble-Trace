use super::*;
use mt_model::sim::enums::{PitState, TrackSurface};
use mt_model::sim::flags::CHECKERED;
use mt_model::sim::session::{CarEntry, QualifyResultEntry, SessionEntry};

fn garaged_car_idx_frame() -> CarIdxFrame {
    // What the sim reports for a car that left the world: everything cleared.
    CarIdxFrame {
        car_idx_lap_dist_pct: vec![-1.0],
        car_idx_on_pit_road: vec![false],
        car_idx_position: vec![0],
        car_idx_class_position: vec![0],
        car_idx_lap: vec![0],
        car_idx_laps_completed: vec![0],
        car_idx_last_lap_time: vec![-1.0],
        car_idx_best_lap_time: vec![-1.0],
        car_idx_f2_time: vec![0.0],
        car_idx_est_time: vec![0.0],
        car_idx_track_surface: vec![TrackSurface::NotInWorld],
        car_idx_tire_compound: vec![-1],
        car_idx_session_flags: vec![0],
        spotter: None,
    }
}

fn session_with_result(result: ResultPosition) -> SessionSnapshot {
    SessionSnapshot {
        player_car_idx: 0,
        current_session_num: 0,
        cars: vec![CarEntry {
            car_idx: 0,
            ..Default::default()
        }],
        sessions: vec![SessionEntry {
            results_positions: vec![result],
            ..Default::default()
        }],
        ..Default::default()
    }
}

fn race_session() -> SessionSnapshot {
    SessionSnapshot {
        player_car_idx: 0,
        current_session_num: 0,
        cars: vec![CarEntry {
            car_idx: 0,
            ..Default::default()
        }],
        sessions: vec![SessionEntry {
            session_type: SessionType::Race,
            ..Default::default()
        }],
        ..Default::default()
    }
}

fn two_car_race_session() -> SessionSnapshot {
    let mut session = race_session();

    session.cars.push(CarEntry {
        car_idx: 1,
        ..Default::default()
    });

    session
}

/// Car 0 is the player, car 1 the race leader.
fn two_car_frame(leader_surface: TrackSurface, leader_pct: f32, player_pct: f32) -> CarIdxFrame {
    CarIdxFrame {
        car_idx_lap_dist_pct: vec![player_pct, leader_pct],
        car_idx_on_pit_road: vec![false, false],
        car_idx_position: vec![2, 1],
        car_idx_class_position: vec![2, 1],
        car_idx_lap: vec![1, 1],
        car_idx_laps_completed: vec![1, 1],
        car_idx_last_lap_time: vec![-1.0, -1.0],
        car_idx_best_lap_time: vec![-1.0, -1.0],
        car_idx_f2_time: vec![0.0, 0.0],
        car_idx_est_time: vec![0.0, 0.0],
        car_idx_track_surface: vec![TrackSurface::OnTrack, leader_surface],
        car_idx_tire_compound: vec![-1, -1],
        car_idx_session_flags: vec![0, 0],
        spotter: None,
    }
}

#[test]
fn test_a_towed_leader_loses_the_live_lead() {
    let session = two_car_race_session();
    let state = Mutex::new(DriverEntriesState::default());

    compute(
        &two_car_frame(TrackSurface::OnTrack, 0.5, 0.3),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    // The truck picks the leader up straight off the track: it leaves the world
    // without ever having been on pit road.
    let frame = compute(
        &two_car_frame(TrackSurface::NotInWorld, -1.0, 0.35),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    let leader = frame.entries.iter().find(|e| e.car_idx == 1).unwrap();

    assert!(leader.is_towed);

    // It is still ahead on the road it covered, so the order has not changed yet.
    assert_eq!(leader.live_position, 1);

    // Once the player drives past the point the leader was picked up at, the
    // live order must hand him the lead — the official one still says otherwise.
    let frame = compute(
        &two_car_frame(TrackSurface::NotInWorld, -1.0, 0.6),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    let player = frame.entries.iter().find(|e| e.car_idx == 0).unwrap();

    assert_eq!(player.position, 2);
    assert_eq!(player.live_position, 1);
}

#[test]
fn test_a_car_entering_the_pits_is_not_treated_as_towed() {
    let session = two_car_race_session();
    let state = Mutex::new(DriverEntriesState::default());

    let mut driving_in = two_car_frame(TrackSurface::OnTrack, 0.95, 0.3);
    driving_in.car_idx_on_pit_road = vec![false, true];

    compute(
        &driving_in,
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    let mut in_the_box = two_car_frame(TrackSurface::InPitStall, 0.97, 0.35);
    in_the_box.car_idx_on_pit_road = vec![false, true];

    let frame = compute(
        &in_the_box,
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    let leader = frame.entries.iter().find(|e| e.car_idx == 1).unwrap();

    assert!(!leader.is_towed);
    assert_eq!(leader.live_position, 1);
}

#[test]
fn test_tow_flag_clears_once_the_car_is_dropped_in_its_box() {
    let session = two_car_race_session();
    let state = Mutex::new(DriverEntriesState::default());

    compute(
        &two_car_frame(TrackSurface::OnTrack, 0.5, 0.3),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    let frame = compute(
        &two_car_frame(TrackSurface::NotInWorld, -1.0, 0.35),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    assert!(
        frame
            .entries
            .iter()
            .find(|e| e.car_idx == 1)
            .unwrap()
            .is_towed
    );

    // The truck sets it down in its pit box. It is not racing yet — and may
    // never race again — but the tow is over.
    let mut dropped_off = two_car_frame(TrackSurface::InPitStall, 0.97, 0.4);
    dropped_off.car_idx_on_pit_road = vec![false, true];

    let frame = compute(
        &dropped_off,
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    assert!(
        !frame
            .entries
            .iter()
            .find(|e| e.car_idx == 1)
            .unwrap()
            .is_towed
    );
}

fn racing_car_idx_frame(flags: u32) -> CarIdxFrame {
    racing_car_idx_frame_on_lap(flags, 12)
}

fn racing_car_idx_frame_on_lap(flags: u32, lap: i32) -> CarIdxFrame {
    let mut car_idx = garaged_car_idx_frame();

    car_idx.car_idx_lap_dist_pct = vec![0.3];
    car_idx.car_idx_position = vec![1];
    car_idx.car_idx_lap = vec![lap];
    car_idx.car_idx_laps_completed = vec![lap - 1];
    car_idx.car_idx_track_surface = vec![TrackSurface::OnTrack];
    car_idx.car_idx_session_flags = vec![flags];

    car_idx
}

#[test]
fn test_car_finishes_when_it_crosses_the_line_under_the_checkered() {
    let session = race_session();
    let state = Mutex::new(DriverEntriesState::default());

    compute(
        &racing_car_idx_frame_on_lap(0, 12),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    // The flag comes out on the tick the leader's lap counter ticks over.
    let frame = compute(
        &racing_car_idx_frame_on_lap(CHECKERED, 13),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(frame.entries[0].is_finished);

    // The latch holds once the sim drops the bit again.
    let frame = compute(
        &racing_car_idx_frame_on_lap(0, 13),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(frame.entries[0].is_finished);
}

#[test]
fn test_car_absent_at_the_flag_can_still_finish() {
    let session = race_session();
    let state = Mutex::new(DriverEntriesState::default());

    // The flag is already out on the very first tick we see: there is no
    // previous lap counter to build the baseline from.
    let frame = compute(
        &racing_car_idx_frame_on_lap(CHECKERED, 12),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(!frame.entries[0].is_finished);

    let frame = compute(
        &racing_car_idx_frame_on_lap(0, 13),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(frame.entries[0].is_finished);
}

#[test]
fn test_the_leaders_crossing_arms_the_latch_with_no_flag_bit_at_all() {
    let session = race_session();
    let state = Mutex::new(DriverEntriesState::default());

    // The clock has expired, so the sim sits in `Checkered` while the leader
    // still runs the last lap. Nothing is out yet.
    let frame = compute(
        &racing_car_idx_frame_on_lap(0, 12),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(!frame.entries[0].is_finished);

    // The leader takes the flag — which is this car, a one-car field. Neither
    // flag field carries a bit; the lap counter ticking over is the whole signal.
    let frame = compute(
        &racing_car_idx_frame_on_lap(0, 13),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(frame.entries[0].is_finished);
}

/// Car 0 runs its own race, car 1 leads it by a lap. The finish latch hangs on
/// the leader's crossing, so the two have to move independently.
fn trailing_and_leading_frame(lap: i32, leader_lap: i32) -> CarIdxFrame {
    CarIdxFrame {
        car_idx_lap_dist_pct: vec![0.3, 0.6],
        car_idx_on_pit_road: vec![false, false],
        car_idx_position: vec![2, 1],
        car_idx_class_position: vec![2, 1],
        car_idx_lap: vec![lap, leader_lap],
        car_idx_laps_completed: vec![lap - 1, leader_lap - 1],
        car_idx_last_lap_time: vec![-1.0, -1.0],
        car_idx_best_lap_time: vec![-1.0, -1.0],
        car_idx_f2_time: vec![0.0, 0.0],
        car_idx_est_time: vec![0.0, 0.0],
        car_idx_track_surface: vec![TrackSurface::OnTrack, TrackSurface::OnTrack],
        car_idx_tire_compound: vec![-1, -1],
        car_idx_session_flags: vec![0, 0],
        spotter: None,
    }
}

#[test]
fn test_a_car_crossing_before_the_leader_does_not_finish() {
    let session = two_car_race_session();
    let state = Mutex::new(DriverEntriesState::default());

    compute(
        &trailing_and_leading_frame(12, 13),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    // A timed race whose clock has expired: the sim is already in `Checkered`,
    // but the leader is still on the last lap. Crossing the line here starts a
    // lap, it does not end the race.
    let frame = compute(
        &trailing_and_leading_frame(13, 13),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(!frame.entries.iter().any(|entry| entry.is_finished));

    // The leader takes the flag and finishes on that very crossing.
    let frame = compute(
        &trailing_and_leading_frame(13, 14),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    let leader = frame
        .entries
        .iter()
        .find(|entry| entry.car_idx == 1)
        .unwrap();
    let trailing = frame
        .entries
        .iter()
        .find(|entry| entry.car_idx == 0)
        .unwrap();

    assert!(leader.is_finished);
    assert!(!trailing.is_finished);

    // And the car behind finishes on its next crossing.
    let frame = compute(
        &trailing_and_leading_frame(14, 14),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(frame.entries.iter().all(|entry| entry.is_finished));
}

#[test]
fn test_a_car_that_crosses_before_the_flag_bit_lights_still_finishes() {
    let session = two_car_race_session();
    let state = Mutex::new(DriverEntriesState::default());

    compute(
        &trailing_and_leading_frame(13, 13),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    // Both cross within the same tick, the leader first. `SessionFlags` lights
    // the checkered bit for nobody — the sim shows it to the player's car, which
    // in a real race trailed this pair by ten seconds. Both have finished.
    let frame = compute(
        &trailing_and_leading_frame(14, 14),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(frame.entries.iter().all(|entry| entry.is_finished));
}

#[test]
fn test_a_finished_car_that_leaves_the_session_is_not_towed() {
    let session = race_session();
    let state = Mutex::new(DriverEntriesState::default());

    compute(
        &racing_car_idx_frame_on_lap(0, 12),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    let frame = compute(
        &racing_car_idx_frame_on_lap(0, 13),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(frame.entries[0].is_finished);

    // He quits straight from the racing surface, which is the shape of a tow.
    let mut car_idx = racing_car_idx_frame_on_lap(0, 13);
    car_idx.car_idx_track_surface = vec![TrackSurface::NotInWorld];

    let frame = compute(
        &car_idx,
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(!frame.entries[0].is_towed);
    assert!(frame.entries[0].is_finished);
}

#[test]
fn test_the_official_results_stand_in_for_a_zeroed_lap_counter() {
    let mut session = race_session();

    session.sessions[0].results_positions = vec![ResultPosition {
        car_idx: 0,
        position: 1,
        laps_complete: Some(13),
        ..Default::default()
    }];

    let state = Mutex::new(DriverEntriesState::default());

    compute(
        &racing_car_idx_frame_on_lap(0, 13),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    // The live counter goes to -1 and `ResultsPositions` takes over. Both count
    // completed laps, so the baseline of 12 is beaten by the 13 the results
    // report and the crossing is caught even though it was never seen live. The
    // car is left on track on purpose: this pins the fallback alone, with the
    // rule about leaving the world under the flag kept out of it.
    let mut car_idx = racing_car_idx_frame_on_lap(0, 13);
    car_idx.car_idx_laps_completed = vec![-1];

    let frame = compute(
        &car_idx,
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(frame.entries[0].is_finished);
}

#[test]
fn test_a_car_that_vanishes_under_the_flag_is_finished_not_towed() {
    let session = two_car_race_session();
    let state = Mutex::new(DriverEntriesState::default());

    compute(
        &trailing_and_leading_frame(12, 13),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    // The leader takes the flag, which arms the latch for the field behind it.
    compute(
        &trailing_and_leading_frame(12, 14),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    // He crosses the line and quits inside the same tick, so his lap counter is
    // never seen to increment: the sim zeroes the live value on the way out and
    // the frame still reads the lap he was on.
    let mut car_idx = trailing_and_leading_frame(12, 14);
    car_idx.car_idx_track_surface = vec![TrackSurface::NotInWorld, TrackSurface::OnTrack];

    let frame = compute(
        &car_idx,
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    let quitter = frame
        .entries
        .iter()
        .find(|entry| entry.car_idx == 0)
        .unwrap();

    assert!(quitter.is_finished);
    assert!(!quitter.is_towed);
}

#[test]
fn test_broadcast_checkered_bit_alone_does_not_finish_a_car() {
    let session = race_session();
    let state = Mutex::new(DriverEntriesState::default());

    compute(
        &racing_car_idx_frame_on_lap(0, 12),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    // The leader has taken the flag, so the sim shows the checkered bit to this
    // car too — but it is still a lap away from the line.
    let frame = compute(
        &racing_car_idx_frame_on_lap(CHECKERED, 12),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    assert!(!frame.entries[0].is_finished);
}

#[test]
fn test_a_lap_limited_race_finishes_the_leader_on_the_tick_it_turns_checkered() {
    let session = two_car_race_session();
    let state = Mutex::new(DriverEntriesState::default());

    compute(
        &trailing_and_leading_frame(12, 13),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    // A lap-limited race enters `Checkered` on the very tick the leader crosses,
    // with no lap left for the state to wait on.
    let frame = compute(
        &trailing_and_leading_frame(12, 14),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Checkered),
        &state,
    );

    let leader = frame
        .entries
        .iter()
        .find(|entry| entry.car_idx == 1)
        .unwrap();
    let trailing = frame
        .entries
        .iter()
        .find(|entry| entry.car_idx == 0)
        .unwrap();

    assert!(leader.is_finished);
    assert!(!trailing.is_finished);
}

#[test]
fn test_cool_down_classifies_cars_that_never_crossed_the_line() {
    let session = race_session();
    let state = Mutex::new(DriverEntriesState::default());

    let frame = compute(
        &racing_car_idx_frame(0),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    assert!(!frame.entries[0].is_finished);

    let frame = compute(
        &racing_car_idx_frame(0),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::CoolDown),
        &state,
    );

    assert!(frame.entries[0].is_finished);
}

#[test]
fn test_finish_latch_does_not_apply_outside_a_race() {
    let mut session = race_session();
    session.sessions[0].session_type = SessionType::Practice;

    let state = Mutex::new(DriverEntriesState::default());

    let frame = compute(
        &racing_car_idx_frame(CHECKERED),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::CoolDown),
        &state,
    );

    assert!(!frame.entries[0].is_finished);
}

#[test]
fn test_finish_latch_clears_on_the_next_session() {
    let session = race_session();
    let state = Mutex::new(DriverEntriesState::default());

    compute(
        &racing_car_idx_frame(0),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::CoolDown),
        &state,
    );

    let mut next_session = race_session();
    next_session.current_session_num = 1;
    next_session.sessions.push(SessionEntry {
        session_type: SessionType::Race,
        ..Default::default()
    });

    let frame = compute(
        &racing_car_idx_frame(0),
        &next_session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    assert!(!frame.entries[0].is_finished);
}

#[test]
fn test_garaged_car_falls_back_to_results_positions() {
    let session = session_with_result(ResultPosition {
        car_idx: 0,
        position: 4,
        // Second in class, 1-indexed as the source layer delivers it.
        class_position: Some(2),
        lap: Some(0),
        time: Some(12.5),
        fastest_time: Some(91.2),
        last_time: Some(92.4),
        laps_complete: Some(17),
        reason_out_id: Some(0),
    });

    let state = Mutex::new(DriverEntriesState::default());
    let frame = compute(
        &garaged_car_idx_frame(),
        &session,
        &HashMap::new(),
        false,
        None,
        &state,
    );

    let entry = &frame.entries[0];

    assert_eq!(entry.position, 4);
    assert_eq!(entry.class_position, 2);
    assert_eq!(entry.lap, 17);
    assert_eq!(entry.best_lap_time, Some(91.2));
    assert_eq!(entry.last_lap_time, Some(92.4));
    assert!(!entry.is_retired);
}

#[test]
fn test_live_values_win_over_results_positions() {
    let session = session_with_result(ResultPosition {
        car_idx: 0,
        position: 4,
        class_position: Some(1),
        lap: Some(0),
        time: Some(12.5),
        fastest_time: Some(91.2),
        last_time: Some(92.4),
        laps_complete: Some(17),
        reason_out_id: Some(0),
    });

    let mut car_idx = garaged_car_idx_frame();
    car_idx.car_idx_lap_dist_pct = vec![0.3];
    car_idx.car_idx_position = vec![2];
    car_idx.car_idx_class_position = vec![1];
    car_idx.car_idx_lap = vec![19];
    car_idx.car_idx_laps_completed = vec![18];
    car_idx.car_idx_best_lap_time = vec![90.0];
    car_idx.car_idx_last_lap_time = vec![90.5];
    car_idx.car_idx_track_surface = vec![TrackSurface::OnTrack];

    let state = Mutex::new(DriverEntriesState::default());
    let frame = compute(&car_idx, &session, &HashMap::new(), false, None, &state);

    let entry = &frame.entries[0];

    assert_eq!(entry.position, 2);
    assert_eq!(entry.class_position, 1);
    assert_eq!(entry.lap, 19);
    assert_eq!(entry.best_lap_time, Some(90.0));
    assert_eq!(entry.last_lap_time, Some(90.5));
}

#[test]
fn test_non_zero_reason_out_marks_entry_retired() {
    let session = session_with_result(ResultPosition {
        car_idx: 0,
        position: 12,
        class_position: Some(5),
        lap: None,
        time: None,
        fastest_time: Some(95.0),
        last_time: Some(96.0),
        laps_complete: Some(3),
        reason_out_id: Some(2),
    });

    let state = Mutex::new(DriverEntriesState::default());
    let frame = compute(
        &garaged_car_idx_frame(),
        &session,
        &HashMap::new(),
        false,
        None,
        &state,
    );

    assert!(frame.entries[0].is_retired);
}

#[test]
fn test_parse_start_positions_from_qualify_maps_car_idx_to_positions() {
    let entries = vec![
        QualifyResultEntry {
            car_idx: 0,
            position: 1,
            class_position: Some(1),
            ..Default::default()
        },
        QualifyResultEntry {
            car_idx: 5,
            position: 2,
            class_position: Some(2),
            ..Default::default()
        },
    ];

    let map = parse_start_positions_from_qualify(&entries);

    assert_eq!(map.get(&0), Some(&(1, 1)));
    assert_eq!(map.get(&5), Some(&(2, 2)));
}

#[test]
fn test_parse_start_positions_from_qualify_fallback_class_pos() {
    let entries = vec![QualifyResultEntry {
        car_idx: 3,
        position: 3,
        class_position: None,
        ..Default::default()
    }];

    let map = parse_start_positions_from_qualify(&entries);

    // With no class position the overall one stands in for it.
    assert_eq!(map.get(&3), Some(&(3, 3)));
}

#[test]
fn test_parse_start_positions_prefers_qualify_over_results() {
    // This test validates the priority rule exercised in runtime.rs:
    // QualifyResultsInfo (non-empty) wins over ResultsPositions, because
    // ResultsPositions reflects CURRENT race order, not the starting grid.
    let results = vec![ResultPosition {
        car_idx: 1,
        position: 2,
        class_position: Some(2),
        lap: None,
        time: None,
        fastest_time: None,
        last_time: None,
        laps_complete: None,
        reason_out_id: None,
    }];

    let qualify = vec![QualifyResultEntry {
        car_idx: 1,
        position: 1, // pole — different from where the results have it
        class_position: Some(1),
        ..Default::default()
    }];

    let from_results = parse_start_positions(&results);
    let from_qualify = parse_start_positions_from_qualify(&qualify);

    // Runtime picks from_qualify when non-empty
    assert_eq!(from_qualify.get(&1), Some(&(1, 1)));
    assert_eq!(from_results.get(&1), Some(&(2, 2)));
    // Confirm they differ — so the selection matters
    assert_ne!(from_qualify.get(&1), from_results.get(&1));
}

#[test]
fn test_parse_start_positions_from_qualify_empty() {
    let map = parse_start_positions_from_qualify(&[]);
    assert!(map.is_empty());
}

fn apply_pit_machine(
    pit_states: &mut HashMap<i32, PitState>,
    car_idx: i32,
    on_pit_road: bool,
    track_surface: TrackSurface,
) -> PitState {
    let prev = pit_states.get(&car_idx).copied().unwrap_or(PitState::None);
    let next = next_pit_state(prev, on_pit_road, track_surface);
    pit_states.insert(car_idx, next);
    next
}

#[test]
fn test_pit_state_none_when_not_on_pit_road() {
    let mut states: HashMap<i32, PitState> = HashMap::new();
    let result = apply_pit_machine(&mut states, 1, false, TrackSurface::OnTrack);
    assert_eq!(result, PitState::None);
}

#[test]
fn test_pit_state_in_when_entering_pit_road() {
    let mut states: HashMap<i32, PitState> = HashMap::new();
    let result = apply_pit_machine(&mut states, 1, true, TrackSurface::AproachingPits);
    assert_eq!(result, PitState::In);
}

#[test]
fn test_pit_state_transitions_to_stall() {
    let mut states: HashMap<i32, PitState> = HashMap::new();
    apply_pit_machine(&mut states, 1, true, TrackSurface::AproachingPits);
    let result = apply_pit_machine(&mut states, 1, true, TrackSurface::InPitStall);
    assert_eq!(result, PitState::Stall);
}

#[test]
fn test_pit_state_transitions_to_exit_after_stall() {
    let mut states: HashMap<i32, PitState> = HashMap::new();
    apply_pit_machine(&mut states, 1, true, TrackSurface::AproachingPits);
    apply_pit_machine(&mut states, 1, true, TrackSurface::InPitStall);
    let result = apply_pit_machine(&mut states, 1, true, TrackSurface::AproachingPits);
    assert_eq!(result, PitState::Exit);
}

#[test]
fn test_pit_state_resets_to_none_when_leaving_pit_road() {
    let mut states: HashMap<i32, PitState> = HashMap::new();
    apply_pit_machine(&mut states, 1, true, TrackSurface::AproachingPits);
    apply_pit_machine(&mut states, 1, true, TrackSurface::InPitStall);
    apply_pit_machine(&mut states, 1, true, TrackSurface::AproachingPits);
    let result = apply_pit_machine(&mut states, 1, false, TrackSurface::OnTrack);
    assert_eq!(result, PitState::None);
}

#[test]
fn test_pit_state_stall_directly_if_entering_already_in_stall() {
    let mut states: HashMap<i32, PitState> = HashMap::new();
    let result = apply_pit_machine(&mut states, 1, true, TrackSurface::InPitStall);
    assert_eq!(result, PitState::Stall);
}

pub(crate) fn make_live_entry(
    car_idx: i32,
    position: i32,
    lap: i32,
    lap_dist_pct: f32,
    track_surface: TrackSurface,
) -> DriverEntry {
    DriverEntry {
        car_idx,
        car_class_id: 0,
        tire_compound: String::new(),
        position,
        class_position: position,
        live_position: 0,
        live_class_position: 0,
        start_pos_overall: Some(position),
        start_pos_class: Some(position),
        lap,
        lap_dist_pct,
        last_lap_time: None,
        best_lap_time: None,
        qualify_time: None,
        f2_time: 0.0,
        est_time: 0.0,
        track_surface,
        i_rating: 0,
        is_player: false,
        on_pit_road: false,
        estimated_ir_delta_live: None,
        estimated_ir_delta_official: None,
        relative_lap_dist: 0.0,
        class_est_lap_time: 0.0,
        raw_flags: 0,
        results_position_lap: None,
        results_position_time: None,
        is_retired: false,
        is_finished: false,
        is_towed: false,
        pit_state: PitState::None,
        speed: None,
        pit_lap: None,
        pit_elapsed_s: None,
        last_pit_s: None,
    }
}

fn make_ir_entry(
    car_idx: i32,
    class_position: i32,
    live_class_position: i32,
    i_rating: i32,
) -> DriverEntry {
    let mut entry = make_live_entry(car_idx, class_position, 0, 0.0, TrackSurface::OnTrack);

    entry.class_position = class_position;
    entry.live_class_position = live_class_position;
    entry.i_rating = i_rating;

    entry
}

#[test]
fn test_static_car_fields_stay_off_the_wire() {
    // The frontend joins these on from `SessionSnapshot.cars`; sending them
    // again would put them back on every 10 Hz tick.
    let mut entry = make_live_entry(3, 1, 0, 0.5, TrackSurface::OnTrack);
    entry.car_class_id = 4029;
    entry.i_rating = 2500;

    let json = serde_json::to_value(&entry).unwrap();

    assert!(json.get("carIdx").is_some());
    assert!(json.get("carClassId").is_none());
    assert!(json.get("iRating").is_none());
}

#[test]
fn test_ir_deltas_rank_densely_around_gaps() {
    // Positions numbered over a wider field leave gaps; the field still has to
    // score as three cars ranked 1..3.
    let sparse = vec![
        make_ir_entry(0, 2, 2, 3000),
        make_ir_entry(1, 5, 5, 2000),
        make_ir_entry(2, 9, 9, 1000),
    ];

    let dense = vec![
        make_ir_entry(0, 1, 1, 3000),
        make_ir_entry(1, 2, 2, 2000),
        make_ir_entry(2, 3, 3, 1000),
    ];

    assert_eq!(
        compute_ir_deltas(&sparse, true),
        compute_ir_deltas(&dense, true)
    );
}

#[test]
fn test_ir_deltas_score_an_unplaced_car_as_a_non_starter() {
    // Car 9 sits in the garage: the sim never placed it. It is registered for the
    // race, so it is scored as a non-starter — it loses, and its rating stays in
    // the field the others are scored against. Its live position is ignored.
    let with_non_starter = vec![
        make_ir_entry(0, 1, 1, 3000),
        make_ir_entry(1, 2, 2, 2000),
        make_ir_entry(9, 0, 3, 1500),
        make_ir_entry(2, 3, 4, 1000),
    ];

    let starters_only = vec![
        make_ir_entry(0, 1, 1, 3000),
        make_ir_entry(1, 2, 2, 2000),
        make_ir_entry(2, 3, 3, 1000),
    ];

    let deltas = compute_ir_deltas(&with_non_starter, true);

    assert!(deltas[&9] < 0);
    assert_ne!(deltas, compute_ir_deltas(&starters_only, true));
}

#[test]
fn test_ir_deltas_need_two_starters_in_the_class() {
    // Before anyone is placed there is no race to score, non-starters included.
    let entries = vec![make_ir_entry(0, 1, 1, 2000), make_ir_entry(1, 0, 2, 2000)];

    assert!(compute_ir_deltas(&entries, true).is_empty());
}

#[test]
fn test_ir_deltas_skip_unrated_cars() {
    // An AI car carries no iRating: it is nobody to score against.
    let entries = vec![
        make_ir_entry(0, 1, 1, 2000),
        make_ir_entry(1, 2, 2, 0),
        make_ir_entry(2, 3, 3, 2000),
    ];

    let deltas = compute_ir_deltas(&entries, true);

    assert_eq!(deltas.get(&1), None);
    assert!(deltas[&0] > 0);
    assert!(deltas[&2] < 0);
}

#[test]
fn test_ir_deltas_follow_live_order_mid_lap() {
    // Official positions still show the pre-overtake order; on track car 1 is ahead.
    // Equal iRating, so the delta is symmetric and the live leader is the one gaining.
    let entries = vec![make_ir_entry(0, 1, 2, 2000), make_ir_entry(1, 2, 1, 2000)];

    let deltas = compute_ir_deltas(&entries, true);

    assert!(deltas[&1] > 0);
    assert!(deltas[&0] < 0);
}

#[test]
fn test_ir_deltas_follow_official_order_when_not_live() {
    // Same mid-overtake frame as above. Scored on the official order instead, the
    // car still officially leading is the one gaining — the mirror of the live answer.
    let entries = vec![make_ir_entry(0, 1, 2, 2000), make_ir_entry(1, 2, 1, 2000)];

    let deltas = compute_ir_deltas(&entries, false);

    assert!(deltas[&0] > 0);
    assert!(deltas[&1] < 0);
}

#[test]
fn test_ranking_mode_follows_the_session() {
    assert_eq!(
        resolve_ranking_mode(true, Some(SessionState::Racing)),
        RankingMode::TrackOrder
    );
    assert_eq!(
        resolve_ranking_mode(true, Some(SessionState::ParadeLaps)),
        RankingMode::Grid
    );
    assert_eq!(
        resolve_ranking_mode(true, Some(SessionState::GetInCar)),
        RankingMode::Grid
    );
    assert_eq!(resolve_ranking_mode(true, None), RankingMode::Grid);
    assert_eq!(
        resolve_ranking_mode(false, Some(SessionState::Racing)),
        RankingMode::Official
    );
}

#[test]
fn test_grid_order_ignores_where_the_cars_are_parked() {
    // On the grid the field straddles the start/finish line, so the car sitting
    // at 0.99 has covered a whole lap more than the one at 0.01 as far as lap
    // progress is concerned. Only the qualifying slot means anything here.
    let mut entries = vec![
        make_live_entry(7, 3, 0, 0.99, TrackSurface::OnTrack),
        make_live_entry(2, 1, 0, 0.01, TrackSurface::OnTrack),
        make_live_entry(5, 2, 0, 0.995, TrackSurface::OnTrack),
    ];

    entries[0].start_pos_overall = Some(3);
    entries[1].start_pos_overall = Some(1);
    entries[2].start_pos_overall = Some(2);

    assign_static_positions(&mut entries, grid_sort_key);

    assert_eq!(entries[0].car_idx, 2);
    assert_eq!(entries[1].car_idx, 5);
    assert_eq!(entries[2].car_idx, 7);
    assert_eq!(entries[0].live_position, 1);
}

#[test]
fn test_cars_without_a_grid_slot_line_up_behind_the_grid() {
    // Joined after qualifying: no slot, so nothing to place it by except the
    // official position — and never ahead of a car that actually qualified.
    let mut entries = vec![
        make_live_entry(4, 9, 0, 0.5, TrackSurface::OnTrack),
        make_live_entry(1, 2, 0, 0.5, TrackSurface::OnTrack),
    ];

    entries[0].start_pos_overall = None;
    entries[1].start_pos_overall = Some(20);

    assign_static_positions(&mut entries, grid_sort_key);

    assert_eq!(entries[0].car_idx, 1);
    assert_eq!(entries[1].car_idx, 4);
}

#[test]
fn test_qualifying_ranks_by_the_official_order_not_the_track() {
    // Lone qualify: the sim ranks by best lap, the car half a lap up the road
    // has not beaten it.
    let mut entries = vec![
        make_live_entry(3, 2, 4, 0.90, TrackSurface::OnTrack),
        make_live_entry(8, 1, 4, 0.10, TrackSurface::OnTrack),
    ];

    assign_static_positions(&mut entries, official_sort_key);

    assert_eq!(entries[0].car_idx, 8);
    assert_eq!(entries[0].live_position, 1);
    assert_eq!(entries[1].car_idx, 3);
}

#[test]
fn test_qualify_time_comes_from_the_qualify_results() {
    let mut session = race_session();

    session.qualify_results = vec![QualifyResultEntry {
        car_idx: 0,
        position: 0,
        class_position: Some(0),
        fastest_time: Some(88.5),
        fastest_lap: Some(3),
    }];

    let state = Mutex::new(DriverEntriesState::default());
    let frame = compute(
        &racing_car_idx_frame(0),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    assert_eq!(frame.entries[0].qualify_time, Some(88.5));
}

#[test]
fn test_qualify_time_is_absent_without_a_qualifying_lap() {
    let session = race_session();
    let state = Mutex::new(DriverEntriesState::default());

    let frame = compute(
        &racing_car_idx_frame(0),
        &session,
        &HashMap::new(),
        false,
        Some(SessionState::Racing),
        &state,
    );

    assert_eq!(frame.entries[0].qualify_time, None);
}

#[test]
fn test_live_positions_ignore_official_order() {
    // Practice/qualifying: official position ranks by best lap, live ranks by
    // track order. Both are kept; the frontend decides which one to show.
    let mut entries = vec![
        make_live_entry(0, 2, 3, 0.90, TrackSurface::OnTrack),
        make_live_entry(1, 1, 3, 0.10, TrackSurface::OnTrack),
    ];

    assign_live_positions(&mut entries, &HashMap::new());

    assert_eq!(entries[0].car_idx, 0);
    assert_eq!(entries[0].live_position, 1);
    assert_eq!(entries[0].position, 2);
    assert_eq!(entries[1].live_position, 2);
    assert_eq!(entries[1].position, 1);
}

#[test]
fn test_live_positions_reflect_mid_lap_overtake() {
    // Car 0 is officially P2 but is ahead on track — the pass has not reached
    // the start/finish line yet, so CarIdxPosition still shows the old order.
    let mut entries = vec![
        make_live_entry(1, 1, 3, 0.10, TrackSurface::OnTrack),
        make_live_entry(0, 2, 3, 0.90, TrackSurface::OnTrack),
    ];

    assign_live_positions(&mut entries, &HashMap::new());

    assert_eq!(entries[0].car_idx, 0);
    assert_eq!(entries[0].live_position, 1);
    assert_eq!(entries[1].car_idx, 1);
    assert_eq!(entries[1].live_position, 2);
}

#[test]
fn test_live_positions_rank_lapped_cars_behind() {
    let mut entries = vec![
        make_live_entry(0, 1, 2, 0.05, TrackSurface::OnTrack),
        make_live_entry(1, 2, 1, 0.95, TrackSurface::OnTrack),
    ];

    assign_live_positions(&mut entries, &HashMap::new());

    assert_eq!(entries[0].car_idx, 0);
    assert_eq!(entries[1].car_idx, 1);
}

#[test]
fn test_cars_out_of_world_slot_in_by_official_position() {
    let mut entries = vec![
        make_live_entry(0, 3, 5, 0.50, TrackSurface::NotInWorld),
        make_live_entry(1, 2, 1, 0.10, TrackSurface::OnTrack),
        make_live_entry(2, 4, 1, 0.05, TrackSurface::OnTrack),
    ];

    assign_live_positions(&mut entries, &HashMap::new());

    assert_eq!(entries[0].car_idx, 1);
    assert_eq!(entries[1].car_idx, 0);
    assert_eq!(entries[1].live_position, 2);
    assert_eq!(entries[2].car_idx, 2);
}

#[test]
fn test_live_class_positions_count_within_class() {
    let mut entries = vec![
        make_live_entry(0, 1, 3, 0.90, TrackSurface::OnTrack),
        make_live_entry(1, 2, 3, 0.80, TrackSurface::OnTrack),
        make_live_entry(2, 3, 3, 0.70, TrackSurface::OnTrack),
    ];

    entries[1].car_class_id = 7;

    assign_live_positions(&mut entries, &HashMap::new());

    assert_eq!(entries[0].live_class_position, 1);
    assert_eq!(entries[1].live_class_position, 1);
    assert_eq!(entries[2].live_class_position, 2);
}

#[test]
fn test_pitting_car_holds_its_official_position() {
    // Captured from a live race: the car in its box is far along the lap, but
    // its official position is well down the order. Track distance must not
    // promote it over the cars still racing.
    let mut entries = vec![
        make_live_entry(9, 31, 5, 0.99, TrackSurface::InPitStall),
        make_live_entry(4, 25, 5, 0.507, TrackSurface::OnTrack),
        make_live_entry(28, 26, 5, 0.503, TrackSurface::OnTrack),
        make_live_entry(7, 30, 5, 0.490, TrackSurface::OnTrack),
    ];

    entries[0].on_pit_road = true;

    assign_live_positions(&mut entries, &HashMap::new());

    assert_eq!(entries[0].car_idx, 4);
    assert_eq!(entries[1].car_idx, 28);
    assert_eq!(entries[2].car_idx, 7);
    assert_eq!(entries[3].car_idx, 9);
    assert_eq!(entries[3].live_position, 4);
}

#[test]
fn test_car_in_the_garage_keeps_its_official_position() {
    // The leader being towed must not fall to the bottom of the table.
    let mut entries = vec![
        make_live_entry(11, 1, -1, -1.0, TrackSurface::NotInWorld),
        make_live_entry(37, 2, 6, 0.208, TrackSurface::OnTrack),
        make_live_entry(23, 3, 6, 0.188, TrackSurface::OnTrack),
    ];

    assign_live_positions(&mut entries, &HashMap::new());

    assert_eq!(entries[0].car_idx, 11);
    assert_eq!(entries[0].live_position, 1);
    assert_eq!(entries[1].car_idx, 37);
    assert_eq!(entries[2].car_idx, 23);
}

#[test]
fn test_non_racing_cars_keep_official_order_among_themselves() {
    let mut entries = vec![
        make_live_entry(1, 5, -1, -1.0, TrackSurface::NotInWorld),
        make_live_entry(2, 3, 4, 0.80, TrackSurface::InPitStall),
        make_live_entry(3, 1, 6, 0.10, TrackSurface::OnTrack),
    ];

    entries[1].on_pit_road = true;

    assign_live_positions(&mut entries, &HashMap::new());

    assert_eq!(entries[0].car_idx, 3);
    assert_eq!(entries[1].car_idx, 2);
    assert_eq!(entries[2].car_idx, 1);
}

fn result_at(car_idx: i32, position: i32) -> ResultPosition {
    ResultPosition {
        car_idx,
        position,
        class_position: Some(position),
        lap: Some(0),
        time: Some(0.0),
        fastest_time: None,
        last_time: None,
        laps_complete: Some(0),
        reason_out_id: Some(0),
    }
}

/// Shaped like the capture: the player (car 0) sits in the pit stall carrying a
/// junk live position of 1, cars 1 and 2 are on track with live positions zeroed,
/// and `ResultsPositions` ranks the player last.
fn unpublished_positions_session(session_type: SessionType) -> SessionSnapshot {
    SessionSnapshot {
        player_car_idx: 0,
        current_session_num: 0,
        cars: (0..3)
            .map(|car_idx| CarEntry {
                car_idx,
                i_rating: 2000,
                ..Default::default()
            })
            .collect(),
        sessions: vec![SessionEntry {
            session_type,
            results_positions: vec![result_at(1, 1), result_at(2, 2), result_at(0, 3)],
            ..Default::default()
        }],
        ..Default::default()
    }
}

fn unpublished_positions_frame() -> CarIdxFrame {
    CarIdxFrame {
        car_idx_lap_dist_pct: vec![0.02, 0.60, 0.40],
        car_idx_on_pit_road: vec![true, false, false],
        car_idx_position: vec![1, 0, 0],
        car_idx_class_position: vec![1, 0, 0],
        car_idx_lap: vec![1, 15, 15],
        car_idx_laps_completed: vec![0, 14, 14],
        car_idx_last_lap_time: vec![-1.0, -1.0, -1.0],
        car_idx_best_lap_time: vec![-1.0, -1.0, -1.0],
        car_idx_f2_time: vec![0.0, 0.0, 0.0],
        car_idx_est_time: vec![0.0, 0.0, 0.0],
        car_idx_track_surface: vec![
            TrackSurface::InPitStall,
            TrackSurface::OnTrack,
            TrackSurface::OnTrack,
        ],
        car_idx_tire_compound: vec![-1, -1, -1],
        car_idx_session_flags: vec![0, 0, 0],
        spotter: None,
    }
}

fn compute_unpublished(
    car_idx: &CarIdxFrame,
    session: &SessionSnapshot,
    session_state: SessionState,
) -> DriverEntriesFrame {
    let state = Mutex::new(DriverEntriesState::default());

    compute(
        car_idx,
        session,
        &HashMap::new(),
        true,
        Some(session_state),
        &state,
    )
}

fn player_entry(frame: &DriverEntriesFrame) -> &DriverEntry {
    frame
        .entries
        .iter()
        .find(|entry| entry.is_player)
        .expect("player entry")
}

#[test]
fn test_unpublished_live_positions_rank_the_player_by_results() {
    let session = unpublished_positions_session(SessionType::Race);
    let frame = compute_unpublished(
        &unpublished_positions_frame(),
        &session,
        SessionState::Racing,
    );

    let player = player_entry(&frame);

    assert_eq!(player.position, 3);
    assert_eq!(player.class_position, 3);

    let mut official: Vec<&DriverEntry> = frame.entries.iter().collect();
    official.sort_by_key(|entry| official_sort_key(entry));

    assert_eq!(official.last().map(|entry| entry.car_idx), Some(0));
}

#[test]
fn test_unpublished_live_positions_place_the_player_after_racing_cars() {
    let session = unpublished_positions_session(SessionType::Race);
    let frame = compute_unpublished(
        &unpublished_positions_frame(),
        &session,
        SessionState::Racing,
    );

    let order: Vec<i32> = frame.entries.iter().map(|entry| entry.car_idx).collect();

    assert_eq!(order, vec![1, 2, 0]);
    assert_eq!(player_entry(&frame).live_position, 3);
}

#[test]
fn test_unpublished_live_positions_do_not_project_the_player_as_winner() {
    let session = unpublished_positions_session(SessionType::Race);
    let frame = compute_unpublished(
        &unpublished_positions_frame(),
        &session,
        SessionState::Racing,
    );

    let player_delta = player_entry(&frame).estimated_ir_delta_official;
    let leader_delta = frame
        .entries
        .iter()
        .find(|entry| entry.car_idx == 1)
        .and_then(|entry| entry.estimated_ir_delta_official);

    assert!(player_delta.is_some_and(|delta| delta < 0));
    assert!(leader_delta.is_some_and(|delta| delta > 0));
}

#[test]
fn test_published_live_positions_still_win_over_results() {
    let session = unpublished_positions_session(SessionType::Race);
    let mut car_idx = unpublished_positions_frame();
    car_idx.car_idx_position = vec![1, 3, 2];
    car_idx.car_idx_class_position = vec![1, 3, 2];

    let frame = compute_unpublished(&car_idx, &session, SessionState::Racing);

    assert_eq!(player_entry(&frame).position, 1);
    assert_eq!(player_entry(&frame).class_position, 1);
}

#[test]
fn test_zeroed_positions_before_the_green_keep_the_grid_order() {
    let mut session = unpublished_positions_session(SessionType::Race);
    session.sessions[0].results_positions.clear();

    let mut car_idx = unpublished_positions_frame();
    car_idx.car_idx_position = vec![0, 0, 0];
    car_idx.car_idx_class_position = vec![0, 0, 0];

    let start_positions: HashMap<i32, (i32, i32)> = [(0, (2, 2)), (1, (3, 3)), (2, (1, 1))]
        .into_iter()
        .collect();
    let state = Mutex::new(DriverEntriesState::default());
    let frame = compute(
        &car_idx,
        &session,
        &start_positions,
        false,
        Some(SessionState::ParadeLaps),
        &state,
    );

    let order: Vec<i32> = frame.entries.iter().map(|entry| entry.car_idx).collect();

    assert_eq!(order, vec![2, 0, 1]);
}

#[test]
fn test_player_in_the_garage_in_qualifying_keeps_the_place_set_by_time() {
    let session = unpublished_positions_session(SessionType::Qualify);
    let frame = compute_unpublished(
        &unpublished_positions_frame(),
        &session,
        SessionState::Racing,
    );

    assert_eq!(player_entry(&frame).position, 3);
    assert_eq!(player_entry(&frame).live_position, 3);
}

#[test]
fn test_pit_state_reset_clears_all_states() {
    let mut processor = DriverEntriesProcessor::default();
    processor.reset();
    let locked = processor.state.lock().unwrap();
    assert!(locked.pit_states.is_empty());
}
