use std::collections::HashMap;
use std::sync::Mutex;

use pitwall::SessionInfo;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::iracing::enums::TrackSurface;
use crate::iracing::frames::AllFieldsFrame;
use crate::utils::lock_or_recover;

const NO_CLASS_COLOR: &str = "#888888";
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

fn parse_class_color(raw: &Option<String>) -> String {
    match raw {
        None => NO_CLASS_COLOR.to_string(),
        Some(s) if s.is_empty() => NO_CLASS_COLOR.to_string(),
        Some(s) => {
            let stripped = s
                .strip_prefix("0x")
                .or_else(|| s.strip_prefix("0X"))
                .unwrap_or(s);
            format!("#{stripped}")
        }
    }
}

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
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
}

#[derive(Default)]
pub struct StandingsState {
    pub cached_car_classes: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DriverEntriesFrame {
    pub entries: Vec<DriverEntry>,
    pub player_car_idx: i32,
}

pub fn compute(
    frame: &AllFieldsFrame,
    session: &SessionInfo,
    start_positions: &HashMap<i32, (i32, i32)>,
    compute_ir_delta: bool,
    state: &Mutex<StandingsState>,
) -> DriverEntriesFrame {
    let driver_info = match session.driver_info.as_ref() {
        Some(di) => di,
        None => {
            return DriverEntriesFrame {
                entries: vec![],
                player_car_idx: -1,
            }
        }
    };

    let player_car_idx = driver_info.driver_car_idx.unwrap_or(-1);
    let drivers = match driver_info.drivers.as_ref() {
        Some(d) => d,
        None => {
            return DriverEntriesFrame {
                entries: vec![],
                player_car_idx,
            }
        }
    };

    let driver_tires = driver_info.driver_tires.as_deref().unwrap_or(&[]);

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

    let mut entries: Vec<DriverEntry> = deduped_drivers
        .iter()
        .filter(|d| {
            if d.car_is_pace_car == Some(1) || d.is_spectator == Some(1) {
                return false;
            }
            let idx = d.car_idx as usize;
            if idx >= frame.car_idx_position.len() {
                return false;
            }
            if d.car_idx == player_car_idx {
                return true;
            }
            let pos = frame.car_idx_position.get(idx).copied().unwrap_or(0);
            let lap_pct = frame.car_idx_lap_dist_pct.get(idx).copied().unwrap_or(-1.0);
            pos > 0 || lap_pct >= 0.0
        })
        .map(|d| {
            let idx = d.car_idx as usize;

            let tire_compound_idx = frame.car_idx_tire_compound.get(idx).copied().unwrap_or(-1);
            let tire_compound = if tire_compound_idx >= 0 {
                driver_tires
                    .iter()
                    .find(|t| t.tire_index == Some(tire_compound_idx))
                    .and_then(|t| t.tire_compound_type.clone())
                    .unwrap_or_default()
            } else {
                String::new()
            };

            let (start_overall, start_class) =
                start_positions.get(&d.car_idx).copied().unwrap_or((0, 0));

            let car_screen_name_short = d.car_screen_name_short.clone().unwrap_or_default();
            let car_class_short_name = if car_screen_name_short.is_empty() {
                NO_CLASS_LABEL.to_string()
            } else {
                let mut locked_state = lock_or_recover(state);
                if let Some(cached) = locked_state.cached_car_classes.get(&car_screen_name_short) {
                    let c: String = cached.clone();
                    c
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
                }
            };

            DriverEntry {
                car_idx: d.car_idx,
                user_name: d.user_name.clone(),
                car_number: d.car_number.clone().unwrap_or_default(),
                car_class_id: d.car_class_id.unwrap_or(-1),
                car_class_short_name,
                car_class_color: parse_class_color(&d.car_class_color),
                car_screen_name: d.car_screen_name.clone().unwrap_or_default(),
                car_screen_name_short,
                tire_compound,
                position: frame.car_idx_position.get(idx).copied().unwrap_or(0),
                class_position: frame.car_idx_class_position.get(idx).copied().unwrap_or(0),
                start_pos_overall: start_overall,
                start_pos_class: start_class,
                lap: frame.car_idx_lap.get(idx).copied().unwrap_or(0),
                lap_dist_pct: frame.car_idx_lap_dist_pct.get(idx).copied().unwrap_or(0.0),
                last_lap_time: frame
                    .car_idx_last_lap_time
                    .get(idx)
                    .copied()
                    .unwrap_or(-1.0),
                best_lap_time: frame
                    .car_idx_best_lap_time
                    .get(idx)
                    .copied()
                    .unwrap_or(-1.0),
                f2_time: frame.car_idx_f2_time.get(idx).copied().unwrap_or(0.0),
                est_time: frame.car_idx_est_time.get(idx).copied().unwrap_or(0.0),
                track_surface: TrackSurface::from(
                    frame.car_idx_track_surface.get(idx).copied().unwrap_or(-1),
                ),
                i_rating: d.i_rating.unwrap_or(0),
                lic_string: d.lic_string.clone().unwrap_or_else(|| "R 0.00".to_string()),
                lic_color: d.lic_color.clone().unwrap_or_else(|| "000000".to_string()),
                incidents: d.cur_driver_incident_count.unwrap_or(0),
                is_player: d.car_idx == player_car_idx,
                on_pit_road: frame.car_idx_on_pit_road.get(idx).copied().unwrap_or(false),
                estimated_ir_delta: None,
                relative_lap_dist: 0.0,
                class_est_lap_time: d.car_class_est_lap_time.unwrap_or(0.0) as f32,
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
        if e.i_rating <= 0 || e.class_position <= 0 {
            continue;
        }
        buckets
            .entry(e.car_class_id)
            .or_default()
            .push((e.car_idx, e.class_position, e.i_rating));
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

/// Parse start positions from pitwall's Session.results_positions (Vec<serde_yaml_ng::Value>).
/// Returns a map of carIdx -> (overall_position, class_position) (1-indexed).
pub fn parse_start_positions(results: &[serde_yaml_ng::Value]) -> HashMap<i32, (i32, i32)> {
    #[derive(Deserialize)]
    #[serde(rename_all = "PascalCase")]
    struct ResultPos {
        car_idx: Option<i32>,
        position: Option<i32>,
        class_position: Option<i32>,
    }

    let mut map = HashMap::new();
    for val in results {
        if let Ok(rp) = serde_yaml_ng::from_value::<ResultPos>(val.clone()) {
            if let (Some(idx), Some(pos)) = (rp.car_idx, rp.position) {
                // Position is 1-indexed in iRacing YAML; ClassPosition is 0-indexed.
                let class_pos = rp.class_position.unwrap_or(pos - 1);
                map.insert(idx, (pos, class_pos + 1));
            }
        }
    }
    map
}
