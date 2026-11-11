use std::collections::HashMap;

use super::*;
use crate::strategy::fuel::FuelSettings;
use mt_model::sim::cars::{CarIdxFrame, PacingFrame};
use mt_model::sim::environment::EnvironmentFrame;
use mt_model::sim::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame, PitServiceFrame,
};
use mt_model::sim::session::{CarEntry, SessionEntry};

/// Nishizumi-SR's golden vectors, copied unchanged from
/// <https://github.com/nishizumi-maho/Nishizumi-SR/blob/main/docs/integration/vectors.json>
/// (© nishizumi-maho, MIT). Every section that maps onto a function here is
/// checked against it; `license_strings` and `session_weight_lookups` are
/// not, because this module reads `LicLevel` and the raw `SessionType`.
const VECTORS: &str = include_str!("safety_rating_vectors.json");

#[derive(Deserialize)]
struct Vectors {
    _meta: Meta,
    constants: Constants,
    target_cpi_to_hold_3_00: Vec<TargetCpi>,
    license_levels: Vec<LicenceLevel>,
    band_floors: Vec<BandFloor>,
    sr_cpi: Vec<SrCpi>,
    remap: Vec<Remap>,
    windows: Vec<Window>,
    alphas: Vec<Alpha>,
    update_cpi: Vec<UpdateCpi>,
    project: Vec<Project>,
    corner_accumulator: Vec<CornerRun>,
}

#[derive(Deserialize)]
struct Meta {
    tolerance: Tolerance,
}

#[derive(Deserialize)]
struct Tolerance {
    sr: f64,
    cpi_relative: f64,
}

#[derive(Deserialize)]
struct Constants {
    a_slope: f64,
    r_ratio: f64,
    f0_cpi: f64,
    window_band1: f64,
    window_band_ratio: f64,
    window_factor_rookie: f64,
    window_factor_class_d: f64,
    max_abs_session_delta: f64,
    sr_display_max: f64,
    band_crossing_bonus: f64,
}

#[derive(Deserialize)]
struct TargetCpi {
    class_index: i32,
    target_cpi: f64,
}

#[derive(Deserialize)]
struct LicenceLevel {
    lic_level: i32,
    class_index: i32,
    band: i32,
}

#[derive(Deserialize)]
struct BandFloor {
    class_index: i32,
    band: i32,
    floor_cpi: f64,
}

#[derive(Deserialize)]
struct SrCpi {
    sr: f64,
    class_index: i32,
    band: i32,
    cpi: f64,
    sr_round_trip: f64,
}

#[derive(Deserialize)]
struct Remap {
    cpi: f64,
    class_index: i32,
    band: i32,
    sr: f64,
    final_band: i32,
}

#[derive(Deserialize)]
struct Window {
    band: i32,
    class_index: i32,
    window: f64,
}

#[derive(Deserialize)]
struct Alpha {
    corners: f64,
    band: i32,
    class_index: i32,
    alpha: f64,
}

#[derive(Deserialize)]
struct UpdateCpi {
    cpi_old: f64,
    corners: f64,
    incident_points: f64,
    band: i32,
    class_index: i32,
    cpi_new: f64,
}

#[derive(Deserialize)]
struct Project {
    comment: String,
    sr_before: f64,
    class_index: i32,
    corners: f64,
    incident_points: f64,
    projected_sr: f64,
    delta: f64,
    cpi_new: f64,
}

#[derive(Deserialize)]
struct CornerRun {
    comment: String,
    corners_per_lap: f64,
    samples: Vec<CornerSample>,
    corners: f64,
}

#[derive(Deserialize)]
struct CornerSample {
    lap_dist_pct: f32,
    track_surface: i32,
}

fn vectors() -> Vectors {
    serde_json::from_str(VECTORS).expect("the vectors file parses")
}

fn licence(class_index: i32, band: i32) -> Licence {
    Licence { class_index, band }
}

fn assert_sr(actual: f64, expected: f64, tolerance: &Tolerance, what: &str) {
    assert!(
        (actual - expected).abs() <= tolerance.sr,
        "{what}: {actual} != {expected}"
    );
}

fn assert_cpi(actual: f64, expected: f64, tolerance: &Tolerance, what: &str) {
    assert!(
        (actual - expected).abs() <= tolerance.cpi_relative * expected.abs().max(1.0),
        "{what}: {actual} != {expected}"
    );
}

#[test]
fn the_constants_are_the_fitted_ones() {
    let constants = vectors().constants;

    assert_eq!(A_SLOPE, constants.a_slope);
    assert_eq!(R_RATIO, constants.r_ratio);
    assert_eq!(F0_CPI, constants.f0_cpi);
    assert_eq!(WINDOW_BAND1, constants.window_band1);
    assert_eq!(WINDOW_BAND_RATIO, constants.window_band_ratio);
    assert_eq!(WINDOW_FACTOR_ROOKIE, constants.window_factor_rookie);
    assert_eq!(WINDOW_FACTOR_CLASS_D, constants.window_factor_class_d);
    assert_eq!(MAX_ABS_SESSION_DELTA, constants.max_abs_session_delta);
    assert_eq!(SR_DISPLAY_MAX, constants.sr_display_max);
    assert!((1.0 - A_SLOPE * R_RATIO.ln() - constants.band_crossing_bonus).abs() < 1e-12);
}

#[test]
fn lic_level_carries_class_and_band() {
    for case in vectors().license_levels {
        assert_eq!(
            licence_from_level(case.lic_level),
            licence(case.class_index, case.band),
            "LicLevel {}",
            case.lic_level
        );
    }
}

#[test]
fn the_mapping_matches_the_vectors() {
    let vectors = vectors();
    let tolerance = &vectors._meta.tolerance;

    for case in &vectors.band_floors {
        let what = format!("floor {}/{}", case.class_index, case.band);

        assert_cpi(
            band_floor_cpi(licence(case.class_index, case.band)),
            case.floor_cpi,
            tolerance,
            &what,
        );
    }

    for case in &vectors.sr_cpi {
        let what = format!("sr {} in {}/{}", case.sr, case.class_index, case.band);
        let cpi = cpi_from_sr(case.sr, licence(case.class_index, case.band));

        assert_cpi(cpi, case.cpi, tolerance, &what);
        assert_sr(
            sr_from_cpi(cpi, licence(case.class_index, case.band)),
            case.sr_round_trip,
            tolerance,
            &what,
        );
    }

    for case in &vectors.target_cpi_to_hold_3_00 {
        assert_cpi(
            cpi_from_sr(3.0, licence(case.class_index, 3)),
            case.target_cpi,
            tolerance,
            "target cpi",
        );
    }
}

#[test]
fn the_band_remap_matches_the_vectors() {
    let vectors = vectors();

    for case in &vectors.remap {
        let what = format!("cpi {} from {}/{}", case.cpi, case.class_index, case.band);
        let (sr, band) = remap_band(case.cpi, licence(case.class_index, case.band));

        assert_sr(sr, case.sr, &vectors._meta.tolerance, &what);
        assert_eq!(band, case.final_band, "{what}");
    }
}

#[test]
fn the_moving_average_matches_the_vectors() {
    let vectors = vectors();
    let tolerance = &vectors._meta.tolerance;

    for case in &vectors.windows {
        assert_cpi(
            window_corners(licence(case.class_index, case.band)),
            case.window,
            tolerance,
            "window",
        );
    }

    for case in &vectors.alphas {
        assert_sr(
            session_alpha(case.corners, licence(case.class_index, case.band)),
            case.alpha,
            tolerance,
            "alpha",
        );
    }

    for case in &vectors.update_cpi {
        assert_cpi(
            update_cpi(
                case.cpi_old,
                case.corners,
                case.incident_points,
                licence(case.class_index, case.band),
            ),
            case.cpi_new,
            tolerance,
            "update cpi",
        );
    }
}

#[test]
fn projections_match_the_vectors() {
    let vectors = vectors();
    let tolerance = &vectors._meta.tolerance;

    for case in &vectors.project {
        // The vectors take the band from the rating, as a reader of
        // `LicString` would.
        let start = licence(case.class_index, case.sr_before.floor() as i32);
        let (projected, _) = project(case.sr_before, start, case.corners, case.incident_points);
        let cpi = update_cpi(
            cpi_from_sr(case.sr_before, start),
            case.corners,
            case.incident_points,
            start,
        );

        assert_sr(projected, case.projected_sr, tolerance, &case.comment);
        assert_sr(
            projected - case.sr_before,
            case.delta,
            tolerance,
            &case.comment,
        );
        assert_cpi(cpi, case.cpi_new, tolerance, &case.comment);
    }
}

#[test]
fn corners_follow_the_distance_driven() {
    for run in vectors().corner_accumulator {
        let mut accumulator = CornerAccumulator::default();

        for sample in &run.samples {
            accumulator.update(
                Some(sample.lap_dist_pct),
                TrackSurface::from(sample.track_surface),
                true,
            );
        }

        // The samples are f32 here, as the SDK sends them.
        assert!(
            (accumulator.corners(run.corners_per_lap) - run.corners).abs() < 1e-4,
            "{}",
            run.comment
        );
    }
}

#[test]
fn a_teammates_stint_earns_no_corners() {
    const CORNERS_PER_LAP: f64 = 20.0;
    let mut accumulator = CornerAccumulator::default();

    accumulator.update(Some(0.10), ON_TRACK, true);
    accumulator.update(Some(0.15), ON_TRACK, true);

    // The teammate drives the shared car: still on track, not ours.
    for pct in [0.20, 0.25, 0.30] {
        accumulator.update(Some(pct), ON_TRACK, false);
    }

    // Back in the car: the trail restarts, the stint is not credited.
    accumulator.update(Some(0.35), ON_TRACK, true);
    accumulator.update(Some(0.40), ON_TRACK, true);

    assert!((accumulator.corners(CORNERS_PER_LAP) - 2.0).abs() < 1e-4);
}

#[test]
fn session_weights_follow_the_sporting_code() {
    assert_eq!(session_weight("Race"), WEIGHT_RACE);
    assert_eq!(session_weight("Heat Race"), WEIGHT_RACE);
    assert_eq!(session_weight("Open Qualify"), WEIGHT_OPEN);
    assert_eq!(session_weight("Lone Qualify"), WEIGHT_LONE);
    assert_eq!(session_weight("Time Trial"), WEIGHT_LONE);
    assert_eq!(session_weight("Warmup"), WEIGHT_OPEN);
    assert_eq!(session_weight("Practice"), WEIGHT_OPEN);
    assert_eq!(session_weight("Offline Testing"), 0.0);
    assert_eq!(session_weight("something else"), 0.0);
}

#[test]
fn a_practice_or_test_server_moves_nothing() {
    assert_eq!(event_session_weight("Race", "Practice"), WEIGHT_OPEN);
    assert_eq!(event_session_weight("Practice", "Practice"), 0.0);
    assert_eq!(event_session_weight("Test", "Practice"), 0.0);
    assert_eq!(
        event_session_weight("Time Trial", "Time Trial"),
        WEIGHT_LONE
    );
    assert_eq!(event_session_weight("", "Race"), WEIGHT_RACE);
}

#[test]
fn clean_corners_level_the_session_out() {
    assert_eq!(clean_corners_needed(0.0, 50.0, 25.0), 0.0);
    assert_eq!(clean_corners_needed(4.0, 30.0, 25.0), 70.0);
    assert_eq!(clean_corners_needed(1.0, 40.0, 25.0), 0.0);
}

const ON_TRACK: TrackSurface = TrackSurface::OnTrack;

fn race_session(team_racing: bool) -> SessionSnapshot {
    SessionSnapshot {
        player_car_idx: 0,
        track_num_turns: Some(20),
        team_racing,
        sessions: vec![
            SessionEntry {
                session_type_label: "Practice".to_string(),
                session_laps: "unlimited".to_string(),
                ..SessionEntry::default()
            },
            SessionEntry {
                session_type_label: "Race".to_string(),
                session_laps: "10".to_string(),
                ..SessionEntry::default()
            },
        ],
        cars: vec![CarEntry {
            car_idx: 0,
            // Class C, band 2 — the band 2.75 sits in.
            lic_level: Some(10),
            lic_sub_level: Some(275),
            ..CarEntry::default()
        }],
        ..SessionSnapshot::default()
    }
}

struct Tick {
    session_num: i32,
    pct: f32,
    my_incidents: i32,
    team_incidents: i32,
}

fn race_tick(pct: f32, incidents: i32) -> Tick {
    Tick {
        session_num: 1,
        pct,
        my_incidents: incidents,
        team_incidents: incidents,
    }
}

fn step(
    processor: &mut SafetyRatingProcessor,
    session: &SessionSnapshot,
    tick: Tick,
) -> SafetyRatingFrame {
    let car_idx = CarIdxFrame {
        car_idx_track_surface: vec![ON_TRACK],
        ..CarIdxFrame::default()
    };
    let lap_timing = LapTimingFrame {
        lap: Some(1),
        lap_dist_pct: Some(tick.pct),
        ..LapTimingFrame::default()
    };
    let car_status = CarStatusFrame {
        player_car_my_incident_count: Some(tick.my_incidents),
        player_car_team_incident_count: Some(tick.team_incidents),
        is_on_track: Some(true),
        ..CarStatusFrame::default()
    };
    let start_positions = HashMap::new();
    let ctx = ComputeContext {
        car_dynamics: &CarDynamicsFrame::default(),
        car_inputs: &CarInputsFrame::default(),
        car_idx: &car_idx,
        pacing: &PacingFrame::default(),
        lap_timing: &lap_timing,
        car_status: &car_status,
        pit_service: &PitServiceFrame::default(),
        chassis: &ChassisFrame::default(),
        environment: &EnvironmentFrame::default(),
        session,
        track_length_m: 0.0,
        car_length_m: 0.0,
        start_positions: &start_positions,
        fuel_settings: FuelSettings::default(),
        lap_delta_active: false,
        session_num: Some(tick.session_num),
        session_time: None,
        session_time_remain: None,
        session_state: None,
        session_flags: None,
    };

    processor.frame(&ctx)
}

#[test]
fn incidents_are_the_sims_own_count() {
    let session = race_session(false);
    let mut processor = SafetyRatingProcessor::default();

    // Already 6 when the app first sees the session: they all count.
    step(&mut processor, &session, race_tick(0.10, 6));
    let frame = step(&mut processor, &session, race_tick(0.15, 10));

    assert_eq!(frame.driver_incidents, 10);
    assert_eq!(frame.team_incidents, None, "not a team race");
    assert_eq!(frame.session_weight, WEIGHT_RACE);
    assert_eq!(frame.sr_start, Some(2.75));
    assert!((frame.corners_driven - 1.0).abs() < 1e-4);
}

#[test]
fn the_nordschleife_scores_its_official_corners() {
    let session = SessionSnapshot {
        track_id: 249,
        track_num_turns: Some(154),
        ..race_session(false)
    };
    let mut processor = SafetyRatingProcessor::default();

    step(&mut processor, &session, race_tick(0.10, 0));
    let frame = step(&mut processor, &session, race_tick(0.15, 0));

    assert!(
        (frame.corners_driven - 3.65).abs() < 1e-3,
        "{}",
        frame.corners_driven
    );
}

#[test]
fn a_new_session_starts_from_scratch() {
    let session = race_session(true);
    let mut processor = SafetyRatingProcessor::default();
    let practice = |pct: f32, incidents: i32| Tick {
        session_num: 0,
        pct,
        my_incidents: incidents,
        team_incidents: incidents,
    };

    step(&mut processor, &session, practice(0.10, 0));
    let practice_frame = step(&mut processor, &session, practice(0.20, 3));

    assert_eq!(practice_frame.driver_incidents, 3);
    assert_eq!(practice_frame.session_weight, WEIGHT_OPEN);

    let race_frame = step(&mut processor, &session, race_tick(0.50, 0));

    assert_eq!(race_frame.driver_incidents, 0);
    assert_eq!(race_frame.team_incidents, Some(0));
    assert_eq!(race_frame.corners_driven, 0.0);
    assert_eq!(race_frame.session_weight, WEIGHT_RACE);
}

#[test]
fn a_session_number_dropping_back_for_a_frame_keeps_the_session() {
    let session = race_session(false);
    let mut processor = SafetyRatingProcessor::default();
    let flicker = Tick {
        session_num: 0,
        ..race_tick(0.20, 2)
    };

    step(&mut processor, &session, race_tick(0.10, 2));
    step(&mut processor, &session, race_tick(0.15, 2));
    step(&mut processor, &session, flicker);
    let frame = step(&mut processor, &session, race_tick(0.25, 2));

    assert!(
        (frame.corners_driven - 3.0).abs() < 1e-3,
        "the distance driven survives the flicker: {}",
        frame.corners_driven
    );
    assert_eq!(frame.session_weight, WEIGHT_RACE);
}

fn practice_tick(pct: f32, incidents: i32) -> Tick {
    Tick {
        session_num: 0,
        pct,
        my_incidents: incidents,
        team_incidents: incidents,
    }
}

#[test]
fn the_race_starts_where_the_practice_left_the_rating() {
    let session = race_session(false);
    let mut processor = SafetyRatingProcessor::default();

    step(&mut processor, &session, practice_tick(0.10, 0));
    let practice = step(&mut processor, &session, practice_tick(0.18, 4));
    let practice_end = practice.sr_now.expect("rated");

    assert!(practice_end < 2.75, "four points in a lap cost rating");

    // The YAML still reads 2.75: the race carries the practice's outcome.
    let race = step(&mut processor, &session, race_tick(0.50, 0));

    assert_eq!(race.sr_start, Some(practice_end));
    assert_eq!(race.driver_incidents, 0);
}

#[test]
fn a_rewritten_yaml_rating_replaces_the_carried_one() {
    let mut session = race_session(false);
    let mut processor = SafetyRatingProcessor::default();

    step(&mut processor, &session, practice_tick(0.10, 0));
    step(&mut processor, &session, practice_tick(0.18, 4));
    step(&mut processor, &session, race_tick(0.50, 4));

    // iRacing writes the practice's result into the YAML mid-race.
    session.cars[0].lic_sub_level = Some(271);
    let race = step(&mut processor, &session, race_tick(0.52, 4));

    assert_eq!(race.sr_start, Some(2.71));
}

#[test]
fn the_first_session_starts_from_the_yaml() {
    let session = race_session(false);
    let mut processor = SafetyRatingProcessor::default();

    let race = step(&mut processor, &session, race_tick(0.50, 0));

    assert_eq!(race.sr_start, Some(2.75));
}

const EVENT: i32 = 89_241_518;

fn event_session() -> SessionSnapshot {
    SessionSnapshot {
        sub_session_id: Some(EVENT),
        ..race_session(false)
    }
}

#[test]
fn a_restart_mid_event_picks_up_the_carried_qualifying() {
    let session = event_session();
    let mut before = SafetyRatingProcessor::default();

    step(&mut before, &session, practice_tick(0.10, 0));
    let practice_end = step(&mut before, &session, practice_tick(0.18, 4))
        .sr_now
        .expect("rated");
    step(&mut before, &session, race_tick(0.30, 4));
    step(&mut before, &session, race_tick(0.40, 5));
    let saved = before.state_to_save().expect("a first state is always due");

    // The app restarts: a fresh processor, then the file, then the sim.
    let mut after = SafetyRatingProcessor::default();
    after.command(&ProcessorCommand::RestoreSafetyRating(Box::new(saved)));
    let race = step(&mut after, &session, race_tick(0.45, 5));

    assert_eq!(race.sr_start, Some(practice_end));
    assert_eq!(race.driver_incidents, 5, "the sim's count, restart or not");
    assert!(
        (race.corners_driven - 2.0).abs() < 1e-3,
        "0.10 lap before the restart, the jump over it uncounted"
    );
}

#[test]
fn a_saved_state_never_overwrites_an_event_in_progress() {
    let session = event_session();
    let mut processor = SafetyRatingProcessor::default();

    step(&mut processor, &session, race_tick(0.10, 0));
    processor.command(&ProcessorCommand::RestoreSafetyRating(Box::new(
        SafetyRatingState::empty_for(EVENT),
    )));
    let race = step(&mut processor, &session, race_tick(0.15, 0));

    assert!(race.corners_driven > 0.0);
}

#[test]
fn a_new_event_starts_from_scratch() {
    let session = event_session();
    let mut processor = SafetyRatingProcessor::default();

    step(&mut processor, &session, race_tick(0.10, 0));
    step(&mut processor, &session, race_tick(0.15, 2));

    let next_event = SessionSnapshot {
        sub_session_id: Some(EVENT + 1),
        ..event_session()
    };
    let race = step(&mut processor, &next_event, race_tick(0.20, 0));

    assert_eq!(race.driver_incidents, 0);
    assert_eq!(race.corners_driven, 0.0);
}

#[test]
fn the_state_is_saved_on_a_change_and_every_quarter_lap() {
    let session = event_session();
    let mut processor = SafetyRatingProcessor::default();

    step(&mut processor, &session, race_tick(0.10, 0));
    assert!(processor.state_to_save().is_some(), "the first state");

    step(&mut processor, &session, race_tick(0.15, 0));
    assert!(processor.state_to_save().is_none(), "a twentieth of a lap");

    step(&mut processor, &session, race_tick(0.17, 1));
    assert!(
        processor.state_to_save().is_none(),
        "the count is not a start value"
    );

    for pct in [0.22, 0.27, 0.32, 0.37] {
        step(&mut processor, &session, race_tick(pct, 1));
    }
    assert!(processor.state_to_save().is_some(), "a quarter lap on");

    let next_session = Tick {
        session_num: 2,
        ..race_tick(0.40, 0)
    };
    step(&mut processor, &session, next_session);
    assert!(processor.state_to_save().is_some(), "a new session");
}

#[test]
fn nothing_is_saved_without_an_event_id() {
    let session = race_session(false);
    let mut processor = SafetyRatingProcessor::default();

    step(&mut processor, &session, race_tick(0.10, 0));

    assert!(processor.state_to_save().is_none());
}

#[test]
fn clean_corners_raise_the_estimate() {
    let session = race_session(false);
    let mut processor = SafetyRatingProcessor::default();

    step(&mut processor, &session, race_tick(0.10, 0));
    let frame = step(&mut processor, &session, race_tick(0.15, 0));

    assert!(frame.sr_now.expect("rated") > 2.75);
    assert_eq!(frame.clean_corners_needed, Some(0.0));
}

#[test]
fn incidents_cost_clean_corners() {
    let session = race_session(false);
    let mut processor = SafetyRatingProcessor::default();

    step(&mut processor, &session, race_tick(0.10, 0));
    let frame = step(&mut processor, &session, race_tick(0.15, 4));

    assert!(frame.sr_now.expect("rated") < 2.75);
    assert!(frame.clean_corners_needed.expect("rated") > 0.0);
}

#[test]
fn no_rating_from_the_sim_is_no_estimate() {
    let mut session = race_session(false);
    session.cars[0].lic_sub_level = None;
    let mut processor = SafetyRatingProcessor::default();

    let frame = step(&mut processor, &session, race_tick(0.10, 0));

    assert_eq!(frame.sr_start, None);
    assert_eq!(frame.sr_now, None);
    assert_eq!(frame.clean_corners_needed, None);
}

#[test]
fn a_session_that_does_not_move_sr_needs_no_clean_corners() {
    let mut session = race_session(false);
    session.sessions[1].session_type_label = "Offline Testing".to_string();
    let mut processor = SafetyRatingProcessor::default();

    let frame = step(&mut processor, &session, race_tick(0.10, 4));

    assert_eq!(frame.session_weight, 0.0);
    assert_eq!(frame.sr_now, Some(2.75));
    assert_eq!(frame.clean_corners_needed, None);
}

#[test]
fn a_league_session_is_known_unranked() {
    let mut session = race_session(false);
    session.league_id = Some(4321);
    let mut processor = SafetyRatingProcessor::default();

    let frame = step(&mut processor, &session, race_tick(0.10, 0));

    assert_eq!(frame.is_ranked, Some(false));
}
