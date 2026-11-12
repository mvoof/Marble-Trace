use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use irating::{calculate as calculate_irating_changes, RaceResult};
use serde::{Deserialize, Serialize};

use crate::field::car_speed::CarSpeedTracker;
use crate::field::pit_timing::PitTimingTracker;
use crate::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use mt_model::contract::capabilities::Capabilities;
use mt_model::sim::cars::CarIdxFrame;
use mt_model::sim::enums::{PitState, SessionState, TrackSurface};
use mt_model::sim::session::{
    CarEntry, QualifyResultEntry, ResultPosition, SessionSnapshot, SessionType,
};
use mt_model::utils::lock_or_recover;

const FALLBACK_SORT_POSITION: i32 = 999;

/// One car's standing at this tick. Only what moves during a session travels
/// here: who the car is — driver, number, class, car, licence, rating — is the
/// same for the whole session and reaches the frontend once, in
/// `SessionSnapshot.cars`, which joins it back on by `car_idx`.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DriverEntry {
    pub car_idx: i32,
    /// Copied from the session for the processors that rank and score by class;
    /// never sent.
    #[serde(skip)]
    pub car_class_id: i32,
    /// Live, not static: the compound the car is on now, which a pit stop changes.
    pub tire_compound: String,
    pub position: i32,
    pub class_position: i32,
    /// Track order recomputed from lap progress every tick, once the race is running.
    /// Official `position` only refreshes when a car crosses the start/finish line,
    /// so an overtake mid-lap is invisible there. Before the green flag this is the
    /// starting grid, and outside a race it mirrors the official order — see
    /// `RankingMode`. Which of the two fields is displayed is a frontend choice.
    pub live_position: i32,
    /// Same as `live_position`, but ranked within the car's class.
    pub live_class_position: i32,
    /// Starting grid slot, overall and within the class. `None` when the car
    /// holds none — no qualifying and no results to read one from.
    pub start_pos_overall: Option<i32>,
    pub start_pos_class: Option<i32>,
    pub lap: i32,
    pub lap_dist_pct: f32,
    /// `None` until the car completes a timed lap.
    pub last_lap_time: Option<f32>,
    /// `None` until the car sets a lap time.
    pub best_lap_time: Option<f32>,
    /// Lap time that earned the car its grid slot, from `QualifyResultsInfo`.
    /// `None` when the car set no qualifying time. Survives into the race,
    /// where it is the only lap time the field has until the first one is
    /// completed.
    pub qualify_time: Option<f32>,
    pub f2_time: f32,
    pub est_time: f32,
    pub track_surface: TrackSurface,
    /// Copied from the session for the iRating estimate; never sent.
    #[serde(skip)]
    pub i_rating: i32,
    pub is_player: bool,
    pub on_pit_road: bool,
    pub estimated_ir_delta_live: Option<i32>,
    pub estimated_ir_delta_official: Option<i32>,
    pub relative_lap_dist: f32,
    pub class_est_lap_time: f32,
    pub raw_flags: u32,
    pub results_position_lap: Option<i32>,
    pub results_position_time: Option<f32>,
    /// The sim marked the car as retired or disqualified (`ReasonOutId` != 0).
    /// A car merely sitting in the garage is *not* retired.
    pub is_retired: bool,
    /// The car has crossed the finish line in the current race. Latched — see
    /// the finish-latch block in `compute`.
    pub is_finished: bool,
    /// The car was recovered by the tow truck: it left the world from the track
    /// without ever entering the pit lane. Cleared once it is back in the world.
    pub is_towed: bool,
    pub pit_state: PitState,
    /// Speed along the track in m/s, `None` until two samples of the car exist.
    /// The sim reports it only for the player; every other car's is derived
    /// from its lap distance — see `CarSpeedTracker`.
    pub speed: Option<f32>,
    /// Lap the car came onto pit road on, for the stop it is making or its
    /// last one this session. `None` until it has been on pit road.
    pub pit_lap: Option<i32>,
    /// Seconds on pit road so far this stop; `None` while off it.
    pub pit_elapsed_s: Option<f32>,
    /// Seconds the last completed stop spent on pit road, entry line to exit
    /// line. See `PitTimingTracker`.
    pub last_pit_s: Option<f32>,
}

#[derive(Default)]
pub struct DriverEntriesState {
    pub pit_states: HashMap<i32, PitState>,
    pub finished_cars: HashSet<i32>,
    /// Session the latched finishers belong to — a new session clears them.
    pub finished_session_num: Option<i32>,
    /// Completed-lap count of every car on the previous tick, used as the baseline
    /// the finish latch compares against once the checkered flag comes out. Laps
    /// *completed*, not the lap being driven — see `resolve_laps_completed`.
    pub previous_laps: HashMap<i32, i32>,
    /// Completed-lap counts snapshotted when the checkered flag came out. `None`
    /// while the race is still running.
    pub laps_at_checkered: Option<HashMap<i32, i32>>,
    /// Cars currently under tow, plus the lap progress they had when they were
    /// picked up — a car being carried has no lap distance of its own.
    pub towed_cars: HashMap<i32, f64>,
    /// Track surface and pit-road flag of every car on the previous tick.
    pub previous_location: HashMap<i32, (TrackSurface, bool)>,
    /// Lap progress of every car on the previous tick, kept so a car that vanishes
    /// mid-lap can still be ranked by where it actually was.
    pub previous_progress: HashMap<i32, f64>,
    /// Laps the leader had completed when the session entered `Checkered`. The latch
    /// arms on the tick this count grows — that crossing is the flag coming out.
    pub leader_laps_at_checkered: Option<i32>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DriverEntriesFrame {
    pub entries: Vec<DriverEntry>,
    pub player_car_idx: i32,
    /// What driving through the pit lane costs over the same stretch at racing
    /// pace, measured from the stops the field has made. `None` until one has
    /// been timed from entry to exit. See `PitTimingTracker`.
    pub pit_lane_loss_s: Option<f32>,
    /// The part of that loss from the stall to the exit line: what is still
    /// ahead of a car standing in its box.
    pub pit_exit_loss_s: Option<f32>,
}

pub fn compute(
    car_idx: &CarIdxFrame,
    session: &SessionSnapshot,
    start_positions: &HashMap<i32, (i32, i32)>,
    compute_ir_delta: bool,
    session_state: Option<SessionState>,
    state: &Mutex<DriverEntriesState>,
) -> DriverEntriesFrame {
    let player_car_idx = session.player_car_idx;
    let drivers = &session.cars;

    if drivers.is_empty() {
        return DriverEntriesFrame {
            entries: vec![],
            player_car_idx,
            pit_lane_loss_s: None,
            pit_exit_loss_s: None,
        };
    }

    let driver_tires = &session.driver_tires;

    // In team races, multiple Driver entries share the same car_idx (one per co-driver).
    // Deduplicate by car_idx before building entries: prefer the player's own entry,
    // otherwise keep the first occurrence.
    let mut seen_car_indices: std::collections::HashSet<i32> = std::collections::HashSet::new();
    let deduped_drivers: Vec<_> = {
        let mut result = Vec::new();

        // Pass 1: collect player entry (takes priority in dedup)
        for d in drivers.iter() {
            if d.car_idx == player_car_idx {
                seen_car_indices.insert(d.car_idx);
                result.push(d);
            }
        }

        // Pass 2: collect first occurrence of each other car_idx
        for d in drivers.iter() {
            if seen_car_indices.insert(d.car_idx) {
                result.push(d);
            }
        }

        result
    };

    let mut locked_state = lock_or_recover(state);

    let current_num = session.current_session_num as usize;
    let current_session = session.sessions.get(current_num);
    let results = current_session
        .map(|s| s.results_positions.as_slice())
        .unwrap_or(&[]);

    let is_race = current_session.is_some_and(|s| s.session_type == SessionType::Race);
    let ranking_mode = resolve_ranking_mode(is_race, session_state);

    let mut qualify_times: HashMap<i32, f32> = HashMap::new();

    for entry in &session.qualify_results {
        if let Some(time) = entry.fastest_time {
            qualify_times.insert(entry.car_idx, time);
        }
    }

    if locked_state.finished_session_num != Some(session.current_session_num) {
        locked_state.finished_session_num = Some(session.current_session_num);
        locked_state.finished_cars.clear();
        locked_state.laps_at_checkered = None;
        locked_state.leader_laps_at_checkered = None;
        locked_state.previous_laps.clear();
        locked_state.towed_cars.clear();
        locked_state.previous_location.clear();
        locked_state.previous_progress.clear();
    }

    let mut results_positions_map: HashMap<i32, &ResultPosition> = HashMap::new();

    for result_position in results {
        results_positions_map.insert(result_position.car_idx, result_position);
    }

    let live_positions =
        live_positions_published(car_idx, &deduped_drivers, player_car_idx, results);

    let mut entries: Vec<DriverEntry> = deduped_drivers
        .iter()
        .filter(|d| {
            if d.is_pace_car || d.is_spectator {
                return false;
            }

            let idx = d.car_idx as usize;

            if idx >= car_idx.car_idx_position.len() {
                return false;
            }

            if d.car_idx == player_car_idx {
                return true;
            }

            let pos = car_idx.car_idx_position.get(idx).copied().unwrap_or(0);
            let lap_pct = car_idx
                .car_idx_lap_dist_pct
                .get(idx)
                .copied()
                .unwrap_or(-1.0);

            pos > 0 || lap_pct >= 0.0
        })
        .map(|driver| {
            let idx = driver.car_idx as usize;

            let result = results_positions_map.get(&driver.car_idx).copied();
            let (res_lap, res_time) = result
                .map(|position| (position.lap, position.time))
                .unwrap_or((None, None));

            let tire_compound_idx = car_idx
                .car_idx_tire_compound
                .get(idx)
                .copied()
                .unwrap_or(-1);

            let tire_compound = if tire_compound_idx >= 0 {
                driver_tires
                    .iter()
                    .find(|t| t.tire_index == tire_compound_idx)
                    .map(|t| t.tire_compound_type.clone())
                    .unwrap_or_default()
            } else {
                String::new()
            };

            let start_slot = start_positions.get(&driver.car_idx).copied();
            let start_overall = start_slot
                .map(|(overall, _)| overall)
                .filter(|&pos| pos > 0);
            let start_class = start_slot.map(|(_, class)| class).filter(|&pos| pos > 0);

            DriverEntry {
                car_idx: driver.car_idx,
                car_class_id: driver.car_class_id,
                tire_compound,
                position: car_idx
                    .car_idx_position
                    .get(idx)
                    .copied()
                    .filter(|&pos| live_positions && pos > 0)
                    .or_else(|| {
                        result
                            .map(|position| position.position)
                            .filter(|&pos| pos > 0)
                    })
                    .or(start_overall)
                    .unwrap_or(0),
                class_position: car_idx
                    .car_idx_class_position
                    .get(idx)
                    .copied()
                    .filter(|&pos| live_positions && pos > 0)
                    .or_else(|| result.and_then(|position| position.class_position))
                    .or(start_class)
                    .unwrap_or(0),
                live_position: 0,
                live_class_position: 0,
                start_pos_overall: start_overall,
                start_pos_class: start_class,
                lap: car_idx
                    .car_idx_lap
                    .get(idx)
                    .copied()
                    .filter(|&lap| lap > 0)
                    .or_else(|| result.and_then(|position| position.laps_complete))
                    .unwrap_or(0),
                lap_dist_pct: car_idx
                    .car_idx_lap_dist_pct
                    .get(idx)
                    .copied()
                    .unwrap_or(0.0),
                // The sim zeroes the live CarIdx lap times once a car leaves the world
                // (garage after a session, tow, disconnect). `ResultsPositions` keeps
                // the official times, so they stand in whenever the live value is gone.
                last_lap_time: car_idx
                    .car_idx_last_lap_time
                    .get(idx)
                    .copied()
                    .filter(|time| *time > 0.0)
                    .or_else(|| result.and_then(|position| position.last_time)),
                best_lap_time: car_idx
                    .car_idx_best_lap_time
                    .get(idx)
                    .copied()
                    .filter(|time| *time > 0.0)
                    .or_else(|| result.and_then(|position| position.fastest_time)),
                qualify_time: qualify_times.get(&driver.car_idx).copied(),
                f2_time: car_idx.car_idx_f2_time.get(idx).copied().unwrap_or(0.0),
                est_time: car_idx.car_idx_est_time.get(idx).copied().unwrap_or(0.0),
                track_surface: car_idx
                    .car_idx_track_surface
                    .get(idx)
                    .copied()
                    .unwrap_or(TrackSurface::NotInWorld),
                i_rating: driver.i_rating,
                is_player: driver.car_idx == player_car_idx,
                on_pit_road: car_idx
                    .car_idx_on_pit_road
                    .get(idx)
                    .copied()
                    .unwrap_or(false),
                estimated_ir_delta_live: None,
                estimated_ir_delta_official: None,
                relative_lap_dist: 0.0,
                class_est_lap_time: driver.car_class_est_lap_time,
                raw_flags: car_idx.car_idx_session_flags.get(idx).copied().unwrap_or(0),
                results_position_lap: res_lap,
                results_position_time: res_time,
                is_retired: result
                    .and_then(|position| position.reason_out_id)
                    .is_some_and(|reason| reason != 0),
                is_finished: false,
                is_towed: false,
                pit_state: PitState::None,
                speed: None,
                pit_lap: None,
                pit_elapsed_s: None,
                last_pit_s: None,
            }
        })
        .collect();

    entries.sort_by_key(official_sort_key);

    // Laps completed, resolved once and kept beside the entries rather than on
    // them: only the finish latch needs it, and the wire does not.
    let laps_completed: HashMap<i32, i32> = deduped_drivers
        .iter()
        .map(|driver| {
            (
                driver.car_idx,
                resolve_laps_completed(
                    car_idx,
                    driver.car_idx as usize,
                    results_positions_map.get(&driver.car_idx).copied(),
                ),
            )
        })
        .collect();

    // Finish latch. A car has finished once it crosses the line after the flag came
    // out, which the lap counter records against a baseline snapshotted from the tick
    // before. Whatever is left over is classified when the race ends (`CoolDown`).
    //
    // What that baseline hangs on is the leader, not a flag bit. Neither bit marks the
    // moment the field starts finishing: `CarIdxSessionFlags` carries the flags shown
    // to a driver (black, blue, meatball) and never lights the checkered at all, and
    // the session-wide `SessionFlags` checkered lights when the sim shows the flag to
    // the *player's* car — in a fifteen-car race at the Red Bull Ring that was ten
    // seconds after eleven cars had already taken it, and all eleven went into the
    // baseline with their finishing lap already counted. A baseline they cannot exceed
    // is a badge that never appears, so the whole leading group stayed unmarked until
    // `CoolDown` classified it.
    //
    // The leader's own crossing is the flag. `SessionState::Checkered` is where the
    // watch starts, not where the latch arms: in a timed race the sim enters it when
    // the clock expires, a full lap before anyone finishes, so arming there latches
    // every car one crossing early. So the leader's lap count is recorded there and
    // the latch arms on the tick that count grows.
    if is_race {
        let is_ending = matches!(
            session_state,
            Some(SessionState::Checkered) | Some(SessionState::CoolDown)
        );

        let leader_laps = entries
            .iter()
            .filter_map(|entry| laps_completed.get(&entry.car_idx).copied())
            .max()
            .unwrap_or(0);

        if !is_ending {
            locked_state.leader_laps_at_checkered = None;
        } else if locked_state.leader_laps_at_checkered.is_none() {
            // Seeded from the previous tick, not this one. A lap-limited race enters
            // `Checkered` on the very tick the leader takes the flag, and a watch that
            // started from the already-incremented count would wait for a lap the
            // leader will never drive.
            let leader_before = locked_state
                .previous_laps
                .values()
                .copied()
                .max()
                .unwrap_or(leader_laps);

            locked_state.leader_laps_at_checkered = Some(leader_before);
        }

        // `CoolDown` is the backstop: a race can be ended from the black box or by the
        // host with nobody crossing the line at all.
        let checkered_is_out = matches!(session_state, Some(SessionState::CoolDown))
            || locked_state
                .leader_laps_at_checkered
                .is_some_and(|before| leader_laps > before);

        if checkered_is_out && locked_state.laps_at_checkered.is_none() {
            // The leader needs no special case: on the tick it crosses, the previous
            // tick still holds the lap it was on, so the same comparison that latches
            // everyone behind latches the leader too.
            locked_state.laps_at_checkered = Some(locked_state.previous_laps.clone());
        }

        let race_has_ended = matches!(session_state, Some(SessionState::CoolDown));

        let state = &mut *locked_state;

        for entry in &mut entries {
            // A car missing from the snapshot was not in the field when the flag
            // came out (it joined, rejoined, or this is the first tick after a
            // reconnect). Seed its baseline with the lap it has right now, so it
            // can still latch on its next crossing instead of never at all.
            let completed = laps_completed.get(&entry.car_idx).copied().unwrap_or(0);

            let crossed_the_line = state.laps_at_checkered.as_mut().is_some_and(|laps| {
                let baseline = laps.entry(entry.car_idx).or_insert(completed);

                completed > *baseline
            });

            // A car that leaves the world once the flag is out has finished and
            // gone: quitting straight off the racing surface looks exactly like a
            // tow, and its live lap counter is zeroed on the way out, so the
            // crossing itself may never be observed on any tick. Without this the
            // finisher who quits is never latched and is towed instead.
            let left_after_the_flag = state.laps_at_checkered.is_some()
                && entry.track_surface == TrackSurface::NotInWorld
                && !entry.is_retired
                && entry.lap > 0;

            let classified = race_has_ended && !entry.is_retired && entry.lap > 0;

            if crossed_the_line || left_after_the_flag || classified {
                state.finished_cars.insert(entry.car_idx);
            }

            entry.is_finished = state.finished_cars.contains(&entry.car_idx);
        }
    }

    locked_state.previous_laps = entries
        .iter()
        .map(|e| {
            (
                e.car_idx,
                laps_completed.get(&e.car_idx).copied().unwrap_or(0),
            )
        })
        .collect();

    update_tow_states(&mut entries, &mut locked_state);

    match ranking_mode {
        RankingMode::TrackOrder => assign_live_positions(&mut entries, &locked_state.towed_cars),
        RankingMode::Grid => assign_static_positions(&mut entries, grid_sort_key),
        RankingMode::Official => assign_static_positions(&mut entries, official_sort_key),
    }

    let player_lap_dist = entries
        .iter()
        .find(|e| e.car_idx == player_car_idx)
        .map(|e| e.lap_dist_pct)
        .unwrap_or(0.0);

    for entry in &mut entries {
        let mut diff = entry.lap_dist_pct - player_lap_dist;

        if diff < -0.5 {
            diff += 1.0;
        }

        if diff > 0.5 {
            diff -= 1.0;
        }

        entry.relative_lap_dist = diff;
    }

    // Pit state machine — per-car, persisted across ticks in locked_state.pit_states
    let active_car_indices: HashSet<i32> = entries.iter().map(|e| e.car_idx).collect();

    locked_state
        .pit_states
        .retain(|k, _| active_car_indices.contains(k));

    for entry in &mut entries {
        let prev = locked_state
            .pit_states
            .get(&entry.car_idx)
            .copied()
            .unwrap_or(PitState::None);

        let next = next_pit_state(prev, entry.on_pit_road, entry.track_surface);

        locked_state.pit_states.insert(entry.car_idx, next);
        entry.pit_state = next;
    }

    if compute_ir_delta {
        let live_deltas = compute_ir_deltas(&entries, true);
        let official_deltas = compute_ir_deltas(&entries, false);

        for entry in &mut entries {
            entry.estimated_ir_delta_live = live_deltas.get(&entry.car_idx).copied();
            entry.estimated_ir_delta_official = official_deltas.get(&entry.car_idx).copied();
        }
    }

    DriverEntriesFrame {
        entries,
        player_car_idx,
        pit_lane_loss_s: None,
        pit_exit_loss_s: None,
    }
}

/// Whether this frame's `CarIdxPosition` / `CarIdxClassPosition` can be trusted.
///
/// Seen once in a live race, with the player sitting in the pit stall: the sim zeroed
/// the live position of every car on track and left a junk `1` on the player's own,
/// while `ResultsPositions` stayed correct. Taken at face value the player tied for
/// the lead. So the arrays are judged unpublished when cars other than the player are
/// in the world, none of them holds a live position, and the session already has
/// results to rank by. Before the green the arrays can be all zero for a legitimate
/// reason, but the results are empty then, so the grid ranking is left alone.
fn live_positions_published(
    car_idx: &CarIdxFrame,
    drivers: &[&CarEntry],
    player_car_idx: i32,
    results: &[ResultPosition],
) -> bool {
    if results.is_empty() {
        return true;
    }

    let mut others_in_world = drivers
        .iter()
        .filter(|driver| {
            driver.car_idx != player_car_idx && !driver.is_pace_car && !driver.is_spectator
        })
        .map(|driver| driver.car_idx as usize)
        .filter(|&idx| {
            car_idx
                .car_idx_lap_dist_pct
                .get(idx)
                .is_some_and(|&pct| pct >= 0.0)
        })
        .peekable();

    if others_in_world.peek().is_none() {
        return true;
    }

    others_in_world.any(|idx| {
        car_idx
            .car_idx_position
            .get(idx)
            .is_some_and(|&pos| pos > 0)
    })
}

/// Distance covered so far, used to rank cars between start/finish crossings.
/// `None` for cars that are not on track at all — they cannot be ranked by progress.
fn lap_progress(entry: &DriverEntry) -> Option<f64> {
    if entry.track_surface == TrackSurface::NotInWorld || entry.lap_dist_pct < 0.0 {
        return None;
    }

    Some(entry.lap as f64 + entry.lap_dist_pct as f64)
}

/// Which order `live_position` reports. Distance covered around the lap only ranks
/// the field once the race is actually running: before the green the cars are parked
/// across the start/finish line, so the tail of the grid reads as being a whole lap
/// ahead of pole, and outside a race there is no track order to speak of — the sim's
/// own position already ranks by best lap there, which is the answer that means
/// something in practice and qualifying.
#[derive(Clone, Copy, PartialEq, Debug)]
enum RankingMode {
    TrackOrder,
    Grid,
    Official,
}

/// The green flag has dropped. `Checkered` and `CoolDown` are included: a race that
/// has finished is still a race that started.
fn race_has_started(session_state: Option<SessionState>) -> bool {
    matches!(
        session_state,
        Some(SessionState::Racing) | Some(SessionState::Checkered) | Some(SessionState::CoolDown)
    )
}

fn resolve_ranking_mode(is_race: bool, session_state: Option<SessionState>) -> RankingMode {
    if !is_race {
        return RankingMode::Official;
    }

    if race_has_started(session_state) {
        return RankingMode::TrackOrder;
    }

    RankingMode::Grid
}

/// Starting grid slot, with cars that hold none pushed to the back. Falls back to
/// the official position so a race run without qualifying — where there is no grid
/// to read — still ranks by something the sim provided.
fn grid_sort_key(entry: &DriverEntry) -> i32 {
    entry
        .start_pos_overall
        .unwrap_or_else(|| FALLBACK_SORT_POSITION + official_sort_key(entry))
}

/// Official race position, with cars the sim has not placed yet pushed to the back.
fn official_sort_key(entry: &DriverEntry) -> i32 {
    if entry.position > 0 {
        entry.position
    } else {
        entry.start_pos_overall.unwrap_or(FALLBACK_SORT_POSITION)
    }
}

/// A car is racing when it is out on track under its own race position — not in
/// the pit lane, not in its box, and not sitting in the garage or being towed.
fn is_racing(entry: &DriverEntry) -> bool {
    if entry.on_pit_road {
        return false;
    }

    matches!(
        entry.track_surface,
        TrackSurface::OnTrack | TrackSurface::OffTrack
    )
}

/// Flags the cars the tow truck picked up and remembers the lap progress they had
/// at that moment.
///
/// iRacing has no per-car tow field, but a tow has a shape nothing else does: the
/// car leaves the world straight off the racing surface, without ever driving into
/// the pit lane. A normal stop always shows `on_pit_road` first, so the two cannot
/// be confused. The flag is cleared as soon as the car is back in the world — by
/// then it has a real lap distance of its own once more.
///
/// A driver who takes the checkered flag and then quits the session has that exact
/// shape too — the car is on the racing surface one tick and gone the next, with no
/// pit lane in between — so a car already latched as finished is never towed. What
/// happens after the flag is not a race incident.
/// Laps a car has actually completed.
///
/// `CarIdxLapCompleted` and `ResultsPositions.LapsComplete` count the same thing,
/// so the official results stand in without a change of scale the moment the sim
/// zeroes the live value — which it does for every car that leaves the world. The
/// lap counter beside it (`CarIdxLap`, the lap being driven) is one higher while
/// the car is out there and falls back to a *completed* count when it is gone, and
/// a finish latch comparing the two never fires for a driver who crosses the line
/// and quits.
fn resolve_laps_completed(
    car_idx: &CarIdxFrame,
    idx: usize,
    result: Option<&ResultPosition>,
) -> i32 {
    car_idx
        .car_idx_laps_completed
        .get(idx)
        .copied()
        .filter(|&laps| laps >= 0)
        .or_else(|| result.and_then(|position| position.laps_complete))
        .unwrap_or(0)
}

fn update_tow_states(entries: &mut [DriverEntry], state: &mut DriverEntriesState) {
    let active_car_indices: HashSet<i32> = entries.iter().map(|e| e.car_idx).collect();

    state
        .previous_location
        .retain(|car_idx, _| active_car_indices.contains(car_idx));
    state
        .towed_cars
        .retain(|car_idx, _| active_car_indices.contains(car_idx));

    for entry in entries.iter_mut() {
        let previous = state.previous_location.get(&entry.car_idx).copied();

        let left_the_track_surface = previous.is_some_and(|(surface, on_pit_road)| {
            !on_pit_road && matches!(surface, TrackSurface::OnTrack | TrackSurface::OffTrack)
        });

        let vanished = entry.track_surface == TrackSurface::NotInWorld;
        let has_finished = state.finished_cars.contains(&entry.car_idx);

        if has_finished {
            state.towed_cars.remove(&entry.car_idx);
        }

        if vanished && left_the_track_surface && !entry.is_retired && !has_finished {
            let frozen = state
                .previous_progress
                .get(&entry.car_idx)
                .copied()
                .unwrap_or(entry.lap as f64);

            state.towed_cars.entry(entry.car_idx).or_insert(frozen);
        }

        // The tow ends the moment the car is back in the world — which is its pit
        // box, not the track. Waiting for it to be racing again would keep the flag
        // on a car that is repaired but still stopped, or forever on one abandoned
        // in its box.
        if entry.track_surface != TrackSurface::NotInWorld {
            state.towed_cars.remove(&entry.car_idx);
        }

        entry.is_towed = state.towed_cars.contains_key(&entry.car_idx);

        state
            .previous_location
            .insert(entry.car_idx, (entry.track_surface, entry.on_pit_road));

        if let Some(progress) = lap_progress(entry) {
            state.previous_progress.insert(entry.car_idx, progress);
        }
    }

    state
        .previous_progress
        .retain(|car_idx, _| active_car_indices.contains(car_idx));
}

/// Reorders `entries` into live track order and fills the `live_*` position fields.
///
/// Only cars actually racing are re-ranked by covered distance. Lap distance says
/// nothing about the race position of a car that is stopped in its box or sitting
/// in the garage: iRacing projects pit road onto the main track, and a car rejoining
/// after a stop lands in the middle of a pack it has already lost the time to. Those
/// cars therefore keep the official position and are slotted between the racing cars
/// by it, so a driver who pits neither floats up the table nor drops off the bottom.
///
/// Filled in every session type — outside a race the official order ranks by best
/// lap instead, so the two are genuinely different answers and the frontend picks
/// which one to show (`useLivePositions`, held per widget).
///
/// Towed cars are the exception to the rule above: keeping the official position
/// would leave a car that is being carried back to the pits sitting at the top of
/// the table while the field drives past it. They are ranked by lap progress like
/// racing cars — frozen at where they were picked up while they are out of the
/// world, and by their real progress again once the truck drops them off.
fn assign_live_positions(entries: &mut [DriverEntry], towed_progress: &HashMap<i32, f64>) {
    let progress_of = |entry: &DriverEntry| -> Option<f64> {
        lap_progress(entry).or_else(|| towed_progress.get(&entry.car_idx).copied())
    };

    let mut racing: Vec<DriverEntry> = Vec::with_capacity(entries.len());
    let mut non_racing: Vec<DriverEntry> = Vec::new();

    for entry in entries.iter() {
        let ranked_by_progress = if entry.is_towed {
            progress_of(entry).is_some()
        } else {
            is_racing(entry) && lap_progress(entry).is_some()
        };

        if ranked_by_progress {
            racing.push(entry.clone());
        } else {
            non_racing.push(entry.clone());
        }
    }

    racing.sort_by(|a, b| match (progress_of(a), progress_of(b)) {
        (Some(left), Some(right)) => right.partial_cmp(&left).unwrap_or(Ordering::Equal),
        _ => a.position.cmp(&b.position),
    });

    // Placement below is independent of insertion order, so this only settles cars
    // the sim has not placed at all: they share FALLBACK_SORT_POSITION and would
    // otherwise land in an order that depends on the entry list.
    non_racing.sort_by_key(|entry| std::cmp::Reverse(official_sort_key(entry)));

    let mut merged = racing;

    // `merged` is ordered by lap progress, so official positions are not monotonic
    // along it — a car that just crossed the line has a fresher `position` than one
    // mid-lap ahead of it. Counting the cars with a better official position places
    // the car by how many actually outrank it, instead of stopping at the first
    // out-of-order entry.
    for entry in non_racing {
        let key = official_sort_key(&entry);
        let index = merged
            .iter()
            .filter(|other| official_sort_key(other) < key)
            .count();

        merged.insert(index, entry);
    }

    entries.clone_from_slice(&merged);

    number_positions(entries);
}

/// Orders the field by a key that does not depend on where the cars are on track —
/// the starting grid before the green, the sim's own position everywhere outside a
/// race. `car_idx` breaks ties so cars the sim has not placed keep a stable order
/// instead of shuffling with the entry list.
fn assign_static_positions(entries: &mut [DriverEntry], sort_key: fn(&DriverEntry) -> i32) {
    entries.sort_by_key(|entry| (sort_key(entry), entry.car_idx));

    number_positions(entries);
}

/// Fills `live_position` and `live_class_position` from the order `entries` is in.
fn number_positions(entries: &mut [DriverEntry]) {
    let mut class_counters: HashMap<i32, i32> = HashMap::new();

    for (index, entry) in entries.iter_mut().enumerate() {
        entry.live_position = index as i32 + 1;

        let counter = class_counters.entry(entry.car_class_id).or_insert(0);

        *counter += 1;
        entry.live_class_position = *counter;
    }
}

/// Not iRacing's formula — iRacing publishes none. This is the community estimate
/// from Kenny Powell's "iRacing SOF iRating Calculator" spreadsheet
/// (https://github.com/SIMRacingApps/SIMRacingApps/issues/209#issuecomment-531877336),
/// as implemented by the `irating` crate (https://github.com/Turbo87/irating-rs).
/// What is ours is who races whom: each class is scored on its own, and a car the
/// sim has never placed is a non-starter of that class rather than a finisher.
///
/// `use_live` picks which finishing order the projection assumes: the live on-track
/// order, so the gain/loss updates mid-lap, or the sim's official one, which only
/// moves when a car crosses start/finish. Both are computed every tick and the
/// frontend shows whichever the standings widget is set to.
fn compute_ir_deltas(entries: &[DriverEntry], use_live: bool) -> HashMap<i32, i32> {
    let mut result = HashMap::new();

    // classId -> [(carIdx, rank, iRating)]
    let mut starters: HashMap<i32, Vec<(i32, i32, u32)>> = HashMap::new();
    let mut non_starters: HashMap<i32, Vec<(i32, u32)>> = HashMap::new();

    for entry in entries {
        // No rating (AI, a fresh account) is nobody to score against.
        let Some(i_rating) = u32::try_from(entry.i_rating)
            .ok()
            .filter(|rating| *rating > 0)
        else {
            continue;
        };

        // `class_position` decides who started: a car the sim has not placed at all
        // (garage, never left the pits) is registered but not racing. `assign_live_positions`
        // hands every entry a `live_class_position`, so it cannot make that call.
        if entry.class_position <= 0 {
            non_starters
                .entry(entry.car_class_id)
                .or_default()
                .push((entry.car_idx, i_rating));

            continue;
        }

        let rank = if use_live {
            entry.live_class_position
        } else {
            entry.class_position
        };

        starters
            .entry(entry.car_class_id)
            .or_default()
            .push((entry.car_idx, rank, i_rating));
    }

    for (class_id, mut class_starters) in starters {
        if class_starters.len() < 2 {
            continue;
        }

        // The crate reads the position as a dense rank in `1..=n`. Either source is
        // numbered over every entry, including the non-starters split off above, so
        // it can exceed `n` and leave gaps. Re-rank by it instead of trusting its value.
        class_starters.sort_by_key(|&(_, rank, _)| rank);

        let class_non_starters = non_starters.remove(&class_id).unwrap_or_default();
        let last_starter_rank = class_starters.len();

        let race_results: Vec<RaceResult<i32>> =
            class_starters
                .iter()
                .enumerate()
                .map(|(index, &(car_idx, _, i_rating))| (car_idx, index as u32 + 1, i_rating, true))
                .chain(class_non_starters.iter().enumerate().map(
                    |(index, &(car_idx, i_rating))| {
                        (
                            car_idx,
                            (last_starter_rank + index) as u32 + 1,
                            i_rating,
                            false,
                        )
                    },
                ))
                .map(RaceResult::from)
                .collect();

        for outcome in calculate_irating_changes(race_results) {
            result.insert(
                outcome.race_result.driver,
                outcome.irating_change.round() as i32,
            );
        }
    }

    result
}

/// Stateful processor wrapping the standings computation.
pub struct DriverEntriesProcessor {
    state: Mutex<DriverEntriesState>,
    speeds: CarSpeedTracker,
    pit_timing: PitTimingTracker,
}

impl Default for DriverEntriesProcessor {
    fn default() -> Self {
        Self {
            state: Mutex::new(DriverEntriesState::default()),
            speeds: CarSpeedTracker::default(),
            pit_timing: PitTimingTracker::default(),
        }
    }
}

impl Processor for DriverEntriesProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::DriverEntries
    }

    fn required(&self) -> Capabilities {
        Capabilities::STANDINGS
    }

    fn rate(&self) -> TickRate {
        TickRate::Hz10
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        let mut frame = compute(
            ctx.car_idx,
            ctx.session,
            ctx.start_positions,
            true,
            ctx.session_state,
            &self.state,
        );

        self.speeds.apply(
            &mut frame.entries,
            ctx.session_time,
            ctx.track_length_m,
            ctx.car_dynamics.speed,
        );

        let lane_loss =
            self.pit_timing
                .apply(&mut frame.entries, ctx.session_time, ctx.session_num);

        frame.pit_lane_loss_s = lane_loss.lane_s;
        frame.pit_exit_loss_s = lane_loss.exit_s;

        Some(ComputedOutput::DriverEntries(frame))
    }

    fn reset(&mut self) {
        if let Ok(mut locked) = self.state.lock() {
            *locked = DriverEntriesState::default();
        }

        self.speeds.reset();
        self.pit_timing.reset();
    }
}

/// Parse start positions from the current session's ResultsPositions.
/// Returns a map of carIdx -> (overall_position, class_position), both 1-indexed.
pub fn parse_start_positions(results: &[ResultPosition]) -> HashMap<i32, (i32, i32)> {
    let mut map = HashMap::new();

    for result_position in results {
        let class_pos = result_position
            .class_position
            .unwrap_or(result_position.position);

        map.insert(
            result_position.car_idx,
            (result_position.position, class_pos),
        );
    }

    map
}

/// Parse start positions from QualifyResultsInfo.
/// Used as a fallback when ResultsPositions is empty (e.g. before a race starts).
/// Both fields arrive 1-indexed from the source layer.
pub fn parse_start_positions_from_qualify(
    qualify_results: &[QualifyResultEntry],
) -> HashMap<i32, (i32, i32)> {
    let mut map = HashMap::new();

    for entry in qualify_results {
        let overall = entry.position;
        let class = entry.class_position.unwrap_or(entry.position);
        map.insert(entry.car_idx, (overall, class));
    }

    map
}

/// Per-car pit phase transition: none → in → stall → exit → none.
fn next_pit_state(prev: PitState, on_pit_road: bool, track_surface: TrackSurface) -> PitState {
    if !on_pit_road {
        return PitState::None;
    }

    match prev {
        PitState::None | PitState::In => {
            if track_surface == TrackSurface::InPitStall {
                PitState::Stall
            } else {
                PitState::In
            }
        }
        PitState::Stall => {
            if track_surface == TrackSurface::AproachingPits
                || track_surface == TrackSurface::OnTrack
            {
                PitState::Exit
            } else {
                PitState::Stall
            }
        }
        PitState::Exit => PitState::Exit,
    }
}

#[cfg(test)]
pub(crate) mod tests;
