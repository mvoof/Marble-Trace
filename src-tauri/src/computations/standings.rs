use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::capabilities::Capabilities;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use crate::model::cars::CarIdxFrame;
use crate::model::enums::{PitState, SessionState, TrackSurface};
use crate::model::session::{QualifyResultEntry, ResultPosition, SessionSnapshot, SessionType};
use crate::utils::lock_or_recover;

const NO_CLASS_LABEL: &str = "No Class";
const FALLBACK_SORT_POSITION: i32 = 999;
const NO_TIME: f32 = -1.0;
const IR_CHANGE_SCALE_FACTOR: f64 = 200.0;
const IR_CHANGE_OFFSET: f64 = 100.0;

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DriverEntry {
    pub car_idx: i32,
    pub user_name: String,
    pub car_number: String,
    pub car_class_id: i32,
    pub car_class_short_name: String,
    pub car_class_color: String,
    pub car_screen_name: String,
    pub car_screen_name_short: String,
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
    pub start_pos_overall: i32,
    pub start_pos_class: i32,
    pub lap: i32,
    pub lap_dist_pct: f32,
    pub last_lap_time: f32,
    pub best_lap_time: f32,
    /// Lap time that earned the car its grid slot, from `QualifyResultsInfo`.
    /// `-1.0` when the car set no qualifying time — the same "no time" marker
    /// `best_lap_time` uses. Survives into the race, where it is the only lap
    /// time the field has until the first one is completed.
    pub qualify_time: f32,
    pub f2_time: f32,
    pub est_time: f32,
    pub track_surface: TrackSurface,
    pub i_rating: i32,
    pub lic_string: String,
    pub lic_color: String,
    pub incidents: i32,
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
}

#[derive(Default)]
pub struct StandingsState {
    pub pit_states: HashMap<i32, PitState>,
    pub finished_cars: HashSet<i32>,
    /// Session the latched finishers belong to — a new session clears them.
    pub finished_session_num: Option<i32>,
    /// Lap counter of every car on the previous tick, used as the baseline the
    /// finish latch compares against once the checkered flag comes out.
    pub previous_laps: HashMap<i32, i32>,
    /// Lap counters snapshotted when the checkered flag came out. `None` while
    /// the race is still running.
    pub laps_at_checkered: Option<HashMap<i32, i32>>,
    /// Cars currently under tow, plus the lap progress they had when they were
    /// picked up — a car being carried has no lap distance of its own.
    pub towed_cars: HashMap<i32, f64>,
    /// Track surface and pit-road flag of every car on the previous tick.
    pub previous_location: HashMap<i32, (TrackSurface, bool)>,
    /// Lap progress of every car on the previous tick, kept so a car that vanishes
    /// mid-lap can still be ranked by where it actually was.
    pub previous_progress: HashMap<i32, f64>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DriverEntriesFrame {
    pub entries: Vec<DriverEntry>,
    pub player_car_idx: i32,
}

pub fn compute(
    car_idx: &CarIdxFrame,
    session: &SessionSnapshot,
    start_positions: &HashMap<i32, (i32, i32)>,
    compute_ir_delta: bool,
    session_state: Option<SessionState>,
    state: &Mutex<StandingsState>,
) -> DriverEntriesFrame {
    let player_car_idx = session.player_car_idx;
    let drivers = &session.cars;

    if drivers.is_empty() {
        return DriverEntriesFrame {
            entries: vec![],
            player_car_idx,
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
        locked_state.previous_laps.clear();
        locked_state.towed_cars.clear();
        locked_state.previous_location.clear();
        locked_state.previous_progress.clear();
    }

    let mut results_positions_map: HashMap<i32, &ResultPosition> = HashMap::new();

    for result_position in results {
        results_positions_map.insert(result_position.car_idx, result_position);
    }

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

            let (start_overall, start_class) = start_positions
                .get(&driver.car_idx)
                .copied()
                .unwrap_or((0, 0));

            let car_screen_name_short = driver.car_screen_name_short.clone();

            let sim_class_short_name = driver.car_class_short_name.trim();

            let car_class_short_name = if sim_class_short_name.is_empty() {
                NO_CLASS_LABEL.to_string()
            } else {
                sim_class_short_name.to_string()
            };

            DriverEntry {
                car_idx: driver.car_idx,
                user_name: driver.user_name.clone(),
                car_number: driver.car_number.clone(),
                car_class_id: driver.car_class_id,
                car_class_short_name,
                car_class_color: driver.car_class_color.clone(),
                car_screen_name: driver.car_screen_name.clone(),
                car_screen_name_short,
                tire_compound,
                position: car_idx
                    .car_idx_position
                    .get(idx)
                    .copied()
                    .filter(|&pos| pos > 0)
                    .or_else(|| {
                        result
                            .map(|position| position.position)
                            .filter(|&pos| pos > 0)
                    })
                    .unwrap_or(start_overall),
                class_position: car_idx
                    .car_idx_class_position
                    .get(idx)
                    .copied()
                    .filter(|&pos| pos > 0)
                    .or_else(|| {
                        // `ResultsPositions` reports class position 0-indexed.
                        result
                            .and_then(|position| position.class_position)
                            .map(|pos| pos + 1)
                    })
                    .unwrap_or(start_class),
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
                    .or_else(|| result.and_then(|position| position.last_time))
                    .unwrap_or(-1.0),
                best_lap_time: car_idx
                    .car_idx_best_lap_time
                    .get(idx)
                    .copied()
                    .filter(|time| *time > 0.0)
                    .or_else(|| result.and_then(|position| position.fastest_time))
                    .unwrap_or(NO_TIME),
                qualify_time: qualify_times
                    .get(&driver.car_idx)
                    .copied()
                    .unwrap_or(NO_TIME),
                f2_time: car_idx.car_idx_f2_time.get(idx).copied().unwrap_or(0.0),
                est_time: car_idx.car_idx_est_time.get(idx).copied().unwrap_or(0.0),
                track_surface: car_idx
                    .car_idx_track_surface
                    .get(idx)
                    .copied()
                    .unwrap_or(TrackSurface::NotInWorld),
                i_rating: driver.i_rating,
                lic_string: if driver.lic_string.is_empty() {
                    "R 0.00".to_string()
                } else {
                    driver.lic_string.clone()
                },
                lic_color: if driver.lic_color.is_empty() {
                    "000000".to_string()
                } else {
                    driver.lic_color.clone()
                },
                incidents: driver.incident_count,
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
            }
        })
        .collect();

    entries.sort_by_key(|e| {
        if e.position > 0 {
            e.position
        } else if e.start_pos_overall > 0 {
            e.start_pos_overall
        } else {
            FALLBACK_SORT_POSITION
        }
    });

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

    // Finish latch. The per-car checkered bit is *not* a per-car finish signal: the
    // sim shows the checkered flag to the whole field the moment the leader takes it,
    // so `CarIdxSessionFlags` lights up for everyone at once. A car has actually
    // finished only once it crosses the line after the flag came out — which is what
    // the lap counter, snapshotted from the tick before the flag, records. The leader
    // is covered too: its lap had already incremented on the tick the flag appeared.
    // Whatever is left over is classified when the race itself ends (`CoolDown`).
    if is_race {
        let checkered_is_out = matches!(
            session_state,
            Some(SessionState::Checkered) | Some(SessionState::CoolDown)
        );

        if checkered_is_out && locked_state.laps_at_checkered.is_none() {
            let baseline = locked_state.previous_laps.clone();

            locked_state.laps_at_checkered = Some(baseline);
        }

        let race_has_ended = matches!(session_state, Some(SessionState::CoolDown));

        let state = &mut *locked_state;

        for entry in &mut entries {
            // A car missing from the snapshot was not in the field when the flag
            // came out (it joined, rejoined, or this is the first tick after a
            // reconnect). Seed its baseline with the lap it has right now, so it
            // can still latch on its next crossing instead of never at all.
            let crossed_the_line = state.laps_at_checkered.as_mut().is_some_and(|laps| {
                let baseline = laps.entry(entry.car_idx).or_insert(entry.lap);

                entry.lap > *baseline
            });

            let classified = race_has_ended && !entry.is_retired && entry.lap > 0;

            if crossed_the_line || classified {
                state.finished_cars.insert(entry.car_idx);
            }

            entry.is_finished = state.finished_cars.contains(&entry.car_idx);
        }
    }

    locked_state.previous_laps = entries.iter().map(|e| (e.car_idx, e.lap)).collect();

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
    }
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
    if entry.start_pos_overall > 0 {
        entry.start_pos_overall
    } else {
        FALLBACK_SORT_POSITION + official_sort_key(entry)
    }
}

/// Official race position, with cars the sim has not placed yet pushed to the back.
fn official_sort_key(entry: &DriverEntry) -> i32 {
    if entry.position > 0 {
        entry.position
    } else if entry.start_pos_overall > 0 {
        entry.start_pos_overall
    } else {
        FALLBACK_SORT_POSITION
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
fn update_tow_states(entries: &mut [DriverEntry], state: &mut StandingsState) {
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

        if vanished && left_the_track_surface && !entry.is_retired {
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

// Turbo87 iRating delta algorithm — port of iracing-irating.ts
fn chance(a: f64, b: f64, factor: f64) -> f64 {
    let exp_a = (-a / factor).exp();

    let exp_b = (-b / factor).exp();

    ((1.0 - exp_a) * exp_b) / ((1.0 - exp_b) * exp_a + (1.0 - exp_a) * exp_b)
}

/// `use_live` picks which finishing order the projection assumes: the live on-track
/// order, so the gain/loss updates mid-lap, or the sim's official one, which only
/// moves when a car crosses start/finish. Both are computed every tick and the
/// frontend shows whichever the standings widget is set to.
fn compute_ir_deltas(entries: &[DriverEntry], use_live: bool) -> HashMap<i32, i32> {
    let mut result = HashMap::new();

    let br1 = 1600.0 / std::f64::consts::LN_2;

    // Group by class
    let mut buckets: HashMap<i32, Vec<(i32, i32, i32)>> = HashMap::new(); // classId -> [(carIdx, classPos, iRating)]

    for e in entries {
        // `class_position` gates who takes part: a car the sim has not placed at all
        // (garage, never left the pits) is not racing anyone yet. `assign_live_positions`
        // hands every entry a `live_class_position`, so it cannot make that call.
        if e.i_rating <= 0 || e.class_position <= 0 {
            continue;
        }

        let rank = if use_live {
            e.live_class_position
        } else {
            e.class_position
        };

        buckets
            .entry(e.car_class_id)
            .or_default()
            .push((e.car_idx, rank, e.i_rating));
    }

    // The scoring below treats the position as a dense rank in `1..=n` — it subtracts it
    // from the field size. Either source is numbered over every entry, including the ones
    // skipped above, so it can exceed `n` and leave gaps. Re-rank by it instead of
    // trusting its raw value.
    for bucket in buckets.values_mut() {
        bucket.sort_by_key(|&(_, class_pos, _)| class_pos);

        for (index, entry) in bucket.iter_mut().enumerate() {
            entry.1 = index as i32 + 1;
        }
    }

    for bucket in buckets.values() {
        if bucket.len() < 2 {
            continue;
        }

        let n = bucket.len();

        let ir_ratings: Vec<f64> = bucket.iter().map(|&(_, _, ir)| ir as f64).collect();

        // Build chances matrix
        let mut chances: Vec<Vec<f64>> = vec![vec![0.0; n]; n];

        for i in 0..n {
            for j in 0..n {
                chances[i][j] = chance(ir_ratings[i], ir_ratings[j], br1);
            }
        }

        let expected_scores: Vec<f64> = chances
            .iter()
            .map(|row| row.iter().sum::<f64>() - 0.5)
            .collect();

        let num_registrations = n;
        let num_starters = n; // all are starters (no DNSes in current implementation)
        let num_non_starters = 0usize;

        let fudge_factors: Vec<f64> = bucket
            .iter()
            .enumerate()
            .map(|(i, _)| {
                let x = (num_registrations as f64) - (num_non_starters as f64) / 2.0;
                let finish_rank = bucket[i].1 as f64; // class position
                (x / 2.0 - finish_rank) / IR_CHANGE_OFFSET
            })
            .collect();

        let changes: Vec<f64> = bucket
            .iter()
            .enumerate()
            .map(|(i, &(_, class_pos, _))| {
                ((num_registrations as f64
                    - class_pos as f64
                    - expected_scores[i]
                    - fudge_factors[i])
                    * IR_CHANGE_SCALE_FACTOR)
                    / num_starters as f64
            })
            .collect();

        for (i, &(car_idx, _, _)) in bucket.iter().enumerate() {
            result.insert(car_idx, changes[i].round() as i32);
        }
    }

    result
}

/// Stateful processor wrapping the standings computation.
pub struct StandingsProcessor {
    state: Mutex<StandingsState>,
}

impl Default for StandingsProcessor {
    fn default() -> Self {
        Self {
            state: Mutex::new(StandingsState::default()),
        }
    }
}

impl Processor for StandingsProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::Standings
    }

    fn required(&self) -> Capabilities {
        Capabilities::STANDINGS
    }

    fn rate(&self) -> TickRate {
        TickRate::Hz10
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        let frame = compute(
            ctx.car_idx,
            ctx.session,
            ctx.start_positions,
            true,
            ctx.session_state,
            &self.state,
        );

        Some(ComputedOutput::Standings(frame))
    }

    fn reset(&mut self) {
        if let Ok(mut locked) = self.state.lock() {
            *locked = StandingsState::default();
        }
    }
}

/// Parse start positions from the current session's ResultsPositions.
/// Returns a map of carIdx -> (overall_position, class_position) (1-indexed).
pub fn parse_start_positions(results: &[ResultPosition]) -> HashMap<i32, (i32, i32)> {
    let mut map = HashMap::new();

    for result_position in results {
        // Position is 1-indexed in iRacing YAML; ClassPosition is 0-indexed.
        let class_pos = result_position
            .class_position
            .unwrap_or(result_position.position - 1);

        map.insert(
            result_position.car_idx,
            (result_position.position, class_pos + 1),
        );
    }

    map
}

/// Parse start positions from QualifyResultsInfo.
/// Used as a fallback when ResultsPositions is empty (e.g. before a race starts).
/// QualifyResultEntry.position is 0-indexed (iRacing convention); we convert to 1-indexed.
pub fn parse_start_positions_from_qualify(
    qualify_results: &[QualifyResultEntry],
) -> HashMap<i32, (i32, i32)> {
    let mut map = HashMap::new();

    for entry in qualify_results {
        let overall = entry.position + 1;
        let class = entry.class_position.unwrap_or(entry.position) + 1;
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
mod tests {
    use super::*;
    use crate::model::enums::{PitState, TrackSurface};
    use crate::model::session::{CarEntry, QualifyResultEntry, SessionEntry};

    fn garaged_car_idx_frame() -> CarIdxFrame {
        // What the sim reports for a car that left the world: everything cleared.
        CarIdxFrame {
            car_idx_lap_dist_pct: vec![-1.0],
            car_idx_on_pit_road: vec![false],
            car_idx_position: vec![0],
            car_idx_class_position: vec![0],
            car_idx_lap: vec![0],
            car_idx_last_lap_time: vec![-1.0],
            car_idx_best_lap_time: vec![-1.0],
            car_idx_f2_time: vec![0.0],
            car_idx_est_time: vec![0.0],
            car_idx_track_surface: vec![TrackSurface::NotInWorld],
            car_idx_tire_compound: vec![-1],
            car_idx_session_flags: vec![0],
            car_left_right: None,
        }
    }

    fn session_with_result(result: ResultPosition) -> SessionSnapshot {
        SessionSnapshot {
            player_car_idx: 0,
            current_session_num: 0,
            cars: vec![CarEntry {
                car_idx: 0,
                user_name: "Driver".to_string(),
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
                user_name: "Driver".to_string(),
                ..Default::default()
            }],
            sessions: vec![SessionEntry {
                session_type: SessionType::Race,
                ..Default::default()
            }],
            ..Default::default()
        }
    }

    /// The checkered flag bit the sim broadcasts to the whole field once the leader
    /// takes it — never a per-car finish signal.
    const BROADCAST_CHECKERED_BIT: u32 = 0x0000_0001;

    fn two_car_race_session() -> SessionSnapshot {
        let mut session = race_session();

        session.cars.push(CarEntry {
            car_idx: 1,
            user_name: "Rival".to_string(),
            ..Default::default()
        });

        session
    }

    /// Car 0 is the player, car 1 the race leader.
    fn two_car_frame(
        leader_surface: TrackSurface,
        leader_pct: f32,
        player_pct: f32,
    ) -> CarIdxFrame {
        CarIdxFrame {
            car_idx_lap_dist_pct: vec![player_pct, leader_pct],
            car_idx_on_pit_road: vec![false, false],
            car_idx_position: vec![2, 1],
            car_idx_class_position: vec![2, 1],
            car_idx_lap: vec![1, 1],
            car_idx_last_lap_time: vec![-1.0, -1.0],
            car_idx_best_lap_time: vec![-1.0, -1.0],
            car_idx_f2_time: vec![0.0, 0.0],
            car_idx_est_time: vec![0.0, 0.0],
            car_idx_track_surface: vec![TrackSurface::OnTrack, leader_surface],
            car_idx_tire_compound: vec![-1, -1],
            car_idx_session_flags: vec![0, 0],
            car_left_right: None,
        }
    }

    #[test]
    fn test_a_towed_leader_loses_the_live_lead() {
        let session = two_car_race_session();
        let state = Mutex::new(StandingsState::default());

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
        let state = Mutex::new(StandingsState::default());

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
        let state = Mutex::new(StandingsState::default());

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
        car_idx.car_idx_track_surface = vec![TrackSurface::OnTrack];
        car_idx.car_idx_session_flags = vec![flags];

        car_idx
    }

    #[test]
    fn test_car_finishes_when_it_crosses_the_line_under_the_checkered() {
        let session = race_session();
        let state = Mutex::new(StandingsState::default());

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
            &racing_car_idx_frame_on_lap(BROADCAST_CHECKERED_BIT, 13),
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
        let state = Mutex::new(StandingsState::default());

        // The flag is already out on the very first tick we see: there is no
        // previous lap counter to build the baseline from.
        let frame = compute(
            &racing_car_idx_frame_on_lap(BROADCAST_CHECKERED_BIT, 12),
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
    fn test_broadcast_checkered_bit_alone_does_not_finish_a_car() {
        let session = race_session();
        let state = Mutex::new(StandingsState::default());

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
            &racing_car_idx_frame_on_lap(BROADCAST_CHECKERED_BIT, 12),
            &session,
            &HashMap::new(),
            false,
            Some(SessionState::Checkered),
            &state,
        );

        assert!(!frame.entries[0].is_finished);
    }

    #[test]
    fn test_cool_down_classifies_cars_that_never_crossed_the_line() {
        let session = race_session();
        let state = Mutex::new(StandingsState::default());

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

        let state = Mutex::new(StandingsState::default());

        let frame = compute(
            &racing_car_idx_frame(BROADCAST_CHECKERED_BIT),
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
        let state = Mutex::new(StandingsState::default());

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
            class_position: Some(1),
            lap: Some(0),
            time: Some(12.5),
            fastest_time: Some(91.2),
            last_time: Some(92.4),
            laps_complete: Some(17),
            reason_out_id: Some(0),
        });

        let state = Mutex::new(StandingsState::default());
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
        assert_eq!(entry.best_lap_time, 91.2);
        assert_eq!(entry.last_lap_time, 92.4);
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
        car_idx.car_idx_best_lap_time = vec![90.0];
        car_idx.car_idx_last_lap_time = vec![90.5];
        car_idx.car_idx_track_surface = vec![TrackSurface::OnTrack];

        let state = Mutex::new(StandingsState::default());
        let frame = compute(&car_idx, &session, &HashMap::new(), false, None, &state);

        let entry = &frame.entries[0];

        assert_eq!(entry.position, 2);
        assert_eq!(entry.class_position, 1);
        assert_eq!(entry.lap, 19);
        assert_eq!(entry.best_lap_time, 90.0);
        assert_eq!(entry.last_lap_time, 90.5);
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

        let state = Mutex::new(StandingsState::default());
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
    fn test_parse_start_positions_from_qualify_converts_to_1indexed() {
        let entries = vec![
            QualifyResultEntry {
                car_idx: 0,
                position: 0,
                class_position: Some(0),
                ..Default::default()
            },
            QualifyResultEntry {
                car_idx: 5,
                position: 1,
                class_position: Some(1),
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
            position: 2,
            class_position: None,
            ..Default::default()
        }];

        let map = parse_start_positions_from_qualify(&entries);

        // When class_position is None, falls back to overall position (0-indexed)
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
            class_position: Some(1),
            lap: None,
            time: None,
            fastest_time: None,
            last_time: None,
            laps_complete: None,
            reason_out_id: None,
        }];

        let qualify = vec![QualifyResultEntry {
            car_idx: 1,
            position: 0, // 0-indexed → overall=1 — different from results
            class_position: Some(0),
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

    fn make_live_entry(
        car_idx: i32,
        position: i32,
        lap: i32,
        lap_dist_pct: f32,
        track_surface: TrackSurface,
    ) -> DriverEntry {
        DriverEntry {
            car_idx,
            user_name: String::new(),
            car_number: String::new(),
            car_class_id: 0,
            car_class_short_name: String::new(),
            car_class_color: String::new(),
            car_screen_name: String::new(),
            car_screen_name_short: String::new(),
            tire_compound: String::new(),
            position,
            class_position: position,
            live_position: 0,
            live_class_position: 0,
            start_pos_overall: position,
            start_pos_class: position,
            lap,
            lap_dist_pct,
            last_lap_time: -1.0,
            best_lap_time: -1.0,
            qualify_time: -1.0,
            f2_time: 0.0,
            est_time: 0.0,
            track_surface,
            i_rating: 0,
            lic_string: String::new(),
            lic_color: String::new(),
            incidents: 0,
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
    fn test_ir_deltas_rank_densely_around_skipped_cars() {
        // Car 9 sits in the garage: the sim never placed it, so it races nobody and
        // drops out of the bucket. It still holds a live position, leaving a gap the
        // scoring must not see — the field has to score as three cars ranked 1..3.
        let sparse = vec![
            make_ir_entry(0, 1, 1, 3000),
            make_ir_entry(1, 2, 2, 2000),
            make_ir_entry(9, 0, 3, 1500),
            make_ir_entry(2, 3, 4, 1000),
        ];

        let dense = vec![
            make_ir_entry(0, 1, 1, 3000),
            make_ir_entry(1, 2, 2, 2000),
            make_ir_entry(2, 3, 3, 1000),
        ];

        let sparse_deltas = compute_ir_deltas(&sparse, true);

        assert_eq!(sparse_deltas.get(&9), None);
        assert_eq!(sparse_deltas, compute_ir_deltas(&dense, true));
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

        entries[0].start_pos_overall = 3;
        entries[1].start_pos_overall = 1;
        entries[2].start_pos_overall = 2;

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

        entries[0].start_pos_overall = 0;
        entries[1].start_pos_overall = 20;

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

        let state = Mutex::new(StandingsState::default());
        let frame = compute(
            &racing_car_idx_frame(0),
            &session,
            &HashMap::new(),
            false,
            Some(SessionState::Racing),
            &state,
        );

        assert_eq!(frame.entries[0].qualify_time, 88.5);
    }

    #[test]
    fn test_qualify_time_is_absent_without_a_qualifying_lap() {
        let session = race_session();
        let state = Mutex::new(StandingsState::default());

        let frame = compute(
            &racing_car_idx_frame(0),
            &session,
            &HashMap::new(),
            false,
            Some(SessionState::Racing),
            &state,
        );

        assert_eq!(frame.entries[0].qualify_time, NO_TIME);
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

    #[test]
    fn test_pit_state_reset_clears_all_states() {
        let mut processor = StandingsProcessor::default();
        processor.reset();
        let locked = processor.state.lock().unwrap();
        assert!(locked.pit_states.is_empty());
    }
}
