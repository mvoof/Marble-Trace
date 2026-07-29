use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::capabilities::Capabilities;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use crate::model::cars::CarIdxFrame;
use crate::model::enums::{PitState, TrackSurface};
use crate::model::session::{QualifyResultEntry, ResultPosition, SessionSnapshot};
use crate::utils::lock_or_recover;

const NO_CLASS_LABEL: &str = "No Class";
const MAX_BADGE_LENGTH: usize = 8;
const MIN_ABBR_LENGTH: usize = 2;
const MAX_ABBR_LENGTH: usize = 5;
const FALLBACK_SORT_POSITION: i32 = 999;
const IR_CHANGE_SCALE_FACTOR: f64 = 200.0;
const IR_CHANGE_OFFSET: f64 = 100.0;

static BADGE_EXCEPTIONS: &[(&str, &str)] = &[
    ("Formula Vee", "FVee"),
    ("Ray FF1600", "FF1600"),
    ("Global Mazda MX-5 Cup", "MX-5"),
    ("Legends Ford '34 Coupe", "Legends"),
    ("Skip Barber Formula 2000", "Skippy"),
    ("Dirt Sprint Car", "Sprint"),
    ("Dirt Late Model", "DLM"),
];

static BRANDS_TO_STRIP: &[&str] = &[
    "Toyota ",
    "Cadillac ",
    "Porsche ",
    "Ferrari ",
    "BMW ",
    "Mercedes-AMG ",
    "Dallara ",
    "Chevrolet ",
    "Ford ",
    "Aston Martin ",
    "Audi ",
    "McLaren ",
    "Honda ",
    "Hyundai ",
    "Nissan ",
    "Radical ",
    "Renault ",
    "Volkswagen ",
];

static FLUFF_TO_STRIP: &[&str] = &[
    " Racecar", " Cup", " Series", " Global", " Track", " Sprint", " Lite",
];

fn get_compact_badge_name(screen_name_short: &str) -> String {
    if screen_name_short.is_empty() {
        return "—".to_string();
    }

    for &(key, val) in BADGE_EXCEPTIONS {
        if screen_name_short == key {
            return val.to_string();
        }
    }

    let mut badge = screen_name_short.to_string();

    for &brand in BRANDS_TO_STRIP {
        if badge.starts_with(brand) {
            badge = badge[brand.len()..].to_string();

            break;
        }
    }

    for &fluff in FLUFF_TO_STRIP {
        badge = badge.replace(fluff, "");
    }

    badge = badge.trim().to_string();

    if badge.len() > MAX_BADGE_LENGTH {
        let abbr: String = badge
            .chars()
            .filter(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
            .collect();

        if abbr.len() >= MIN_ABBR_LENGTH && abbr.len() <= MAX_ABBR_LENGTH {
            return abbr;
        }
    }

    badge
}

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
    /// Track order recomputed from lap progress every tick, in every session type.
    /// Official `position` only refreshes when a car crosses the start/finish line,
    /// so an overtake mid-lap is invisible there; outside a race it ranks by best lap
    /// instead of track order. Which of the two is displayed is a frontend choice.
    pub live_position: i32,
    /// Same as `live_position`, but ranked within the car's class.
    pub live_class_position: i32,
    pub start_pos_overall: i32,
    pub start_pos_class: i32,
    pub lap: i32,
    pub lap_dist_pct: f32,
    pub last_lap_time: f32,
    pub best_lap_time: f32,
    pub f2_time: f32,
    pub est_time: f32,
    pub track_surface: TrackSurface,
    pub i_rating: i32,
    pub lic_string: String,
    pub lic_color: String,
    pub incidents: i32,
    pub is_player: bool,
    pub on_pit_road: bool,
    pub estimated_ir_delta: Option<i32>,
    pub relative_lap_dist: f32,
    pub class_est_lap_time: f32,
    pub raw_flags: u32,
    pub results_position_lap: Option<i32>,
    pub results_position_time: Option<f32>,
    pub pit_state: PitState,
}

#[derive(Default)]
pub struct StandingsState {
    pub cached_car_classes: HashMap<String, String>,
    pub pit_states: HashMap<i32, PitState>,
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
    let results = session
        .sessions
        .get(current_num)
        .map(|s| s.results_positions.as_slice())
        .unwrap_or(&[]);

    let mut results_positions_map = HashMap::new();

    for result_position in results {
        results_positions_map.insert(
            result_position.car_idx,
            (result_position.lap, result_position.time),
        );
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

            let (res_lap, res_time) = results_positions_map
                .get(&driver.car_idx)
                .copied()
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

            let car_class_short_name = if car_screen_name_short.is_empty() {
                NO_CLASS_LABEL.to_string()
            } else if let Some(cached) = locked_state.cached_car_classes.get(&car_screen_name_short)
            {
                cached.clone()
            } else {
                let badge = get_compact_badge_name(&car_screen_name_short);

                let result = if badge.is_empty() {
                    NO_CLASS_LABEL.to_string()
                } else {
                    badge
                };

                locked_state
                    .cached_car_classes
                    .insert(car_screen_name_short.clone(), result.clone());

                result
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
                    .unwrap_or(start_overall),
                class_position: car_idx
                    .car_idx_class_position
                    .get(idx)
                    .copied()
                    .filter(|&pos| pos > 0)
                    .unwrap_or(start_class),
                live_position: 0,
                live_class_position: 0,
                start_pos_overall: start_overall,
                start_pos_class: start_class,
                lap: car_idx.car_idx_lap.get(idx).copied().unwrap_or(0),
                lap_dist_pct: car_idx
                    .car_idx_lap_dist_pct
                    .get(idx)
                    .copied()
                    .unwrap_or(0.0),
                last_lap_time: car_idx
                    .car_idx_last_lap_time
                    .get(idx)
                    .copied()
                    .unwrap_or(-1.0),
                best_lap_time: car_idx
                    .car_idx_best_lap_time
                    .get(idx)
                    .copied()
                    .unwrap_or(-1.0),
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
                estimated_ir_delta: None,
                relative_lap_dist: 0.0,
                class_est_lap_time: driver.car_class_est_lap_time,
                raw_flags: car_idx.car_idx_session_flags.get(idx).copied().unwrap_or(0),
                results_position_lap: res_lap,
                results_position_time: res_time,
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

    assign_live_positions(&mut entries);

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
        let deltas = compute_ir_deltas(&entries);

        for entry in &mut entries {
            entry.estimated_ir_delta = deltas.get(&entry.car_idx).copied();
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
/// which one to show (`liveOrderOutsideRace` in the standings widget settings).
fn assign_live_positions(entries: &mut [DriverEntry]) {
    let mut racing: Vec<DriverEntry> = Vec::with_capacity(entries.len());
    let mut non_racing: Vec<DriverEntry> = Vec::new();

    for entry in entries.iter() {
        if is_racing(entry) && lap_progress(entry).is_some() {
            racing.push(entry.clone());
        } else {
            non_racing.push(entry.clone());
        }
    }

    racing.sort_by(|a, b| match (lap_progress(a), lap_progress(b)) {
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

fn compute_ir_deltas(entries: &[DriverEntry]) -> HashMap<i32, i32> {
    let mut result = HashMap::new();

    let br1 = 1600.0 / std::f64::consts::LN_2;

    // Group by class
    let mut buckets: HashMap<i32, Vec<(i32, i32, i32)>> = HashMap::new(); // classId -> [(carIdx, classPos, iRating)]

    for e in entries {
        // Live class position reflects on-track order, so the projected gain/loss
        // updates mid-lap instead of only when a car crosses start/finish.
        let class_pos = if e.live_class_position > 0 {
            e.live_class_position
        } else {
            e.class_position
        };

        if e.i_rating <= 0 || class_pos <= 0 {
            continue;
        }
        buckets
            .entry(e.car_class_id)
            .or_default()
            .push((e.car_idx, class_pos, e.i_rating));
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
    use crate::model::session::QualifyResultEntry;

    #[test]
    fn test_parse_start_positions_from_qualify_converts_to_1indexed() {
        let entries = vec![
            QualifyResultEntry {
                car_idx: 0,
                position: 0,
                class_position: Some(0),
            },
            QualifyResultEntry {
                car_idx: 5,
                position: 1,
                class_position: Some(1),
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
        }];

        let qualify = vec![QualifyResultEntry {
            car_idx: 1,
            position: 0, // 0-indexed → overall=1 — different from results
            class_position: Some(0),
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
            f2_time: 0.0,
            est_time: 0.0,
            track_surface,
            i_rating: 0,
            lic_string: String::new(),
            lic_color: String::new(),
            incidents: 0,
            is_player: false,
            on_pit_road: false,
            estimated_ir_delta: None,
            relative_lap_dist: 0.0,
            class_est_lap_time: 0.0,
            raw_flags: 0,
            results_position_lap: None,
            results_position_time: None,
            pit_state: PitState::None,
        }
    }

    #[test]
    fn test_live_positions_ignore_official_order() {
        // Practice/qualifying: official position ranks by best lap, live ranks by
        // track order. Both are kept; the frontend decides which one to show.
        let mut entries = vec![
            make_live_entry(0, 2, 3, 0.90, TrackSurface::OnTrack),
            make_live_entry(1, 1, 3, 0.10, TrackSurface::OnTrack),
        ];

        assign_live_positions(&mut entries);

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

        assign_live_positions(&mut entries);

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

        assign_live_positions(&mut entries);

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

        assign_live_positions(&mut entries);

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

        assign_live_positions(&mut entries);

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

        assign_live_positions(&mut entries);

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

        assign_live_positions(&mut entries);

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

        assign_live_positions(&mut entries);

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
