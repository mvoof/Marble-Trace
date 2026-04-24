use pitwall::SessionInfo;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::iracing::frames::AllFieldsFrame;

// CarLeftRight enum values from iRacing SDK
const CLR_OFF: i32 = 0;
const CLR_CLEAR: i32 = 1;
const CLR_CAR_LEFT: i32 = 2;
const CLR_CAR_RIGHT: i32 = 3;
const CLR_CAR_LEFT_RIGHT: i32 = 4;
const CLR_CARS_2_LEFT: i32 = 5;
const CLR_CARS_2_RIGHT: i32 = 6;

const MAX_SEARCH_DIST_M: f32 = 50.0;
const ALONGSIDE_THRESHOLD_M: f32 = 5.0;
const BUMPER_THRESHOLD_M: f32 = 2.2;
const CAR_LENGTH_M: f32 = 4.4;

#[derive(Serialize, Deserialize, Type, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum LateralSide {
    Left,
    Right,
    Center,
}

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NearbyCar {
    pub car_idx: i32,
    /// Positive = ahead, negative = behind (meters)
    pub longitudinal_dist: f32,
    pub lateral_side: LateralSide,
    /// Absolute longitudinal distance in meters
    pub clearance: f32,
}

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RadarDistances {
    pub front_dist: f32,
    pub rear_dist: f32,
    pub left_dist: Option<f32>,
    pub right_dist: Option<f32>,
}

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProximityFrame {
    pub nearby_cars: Vec<NearbyCar>,
    pub radar_distances: RadarDistances,
    pub spotter_left: bool,
    pub spotter_right: bool,
}

pub fn parse_track_length(s: &str) -> f32 {
    let s = s.trim();
    if let Some(km_idx) = s.find("km") {
        let num_str = s[..km_idx].trim();
        return num_str.parse::<f32>().unwrap_or(0.0) * 1000.0;
    }
    if let Some(mi_idx) = s.find("mi") {
        let num_str = s[..mi_idx].trim();
        return num_str.parse::<f32>().unwrap_or(0.0) * 1609.34;
    }
    0.0
}

fn spotter_flags(car_left_right: i32) -> (bool, bool) {
    let left = matches!(car_left_right, CLR_CAR_LEFT | CLR_CAR_LEFT_RIGHT | CLR_CARS_2_LEFT);
    let right = matches!(car_left_right, CLR_CAR_RIGHT | CLR_CAR_LEFT_RIGHT | CLR_CARS_2_RIGHT);
    (left, right)
}

pub fn compute(frame: &AllFieldsFrame, session: &SessionInfo) -> ProximityFrame {
    let player_car_idx = session
        .driver_info
        .as_ref()
        .and_then(|di| di.driver_car_idx)
        .unwrap_or(-1);

    let track_length_m = parse_track_length(&session.weekend_info.track_length);

    let car_left_right = frame.car_left_right.unwrap_or(CLR_CLEAR);
    let (spotter_left, spotter_right) = spotter_flags(car_left_right);

    let has_left = spotter_left;
    let has_right = spotter_right;

    if player_car_idx < 0 || track_length_m <= 0.0 {
        return ProximityFrame {
            nearby_cars: vec![],
            radar_distances: RadarDistances {
                front_dist: f32::INFINITY,
                rear_dist: f32::INFINITY,
                left_dist: None,
                right_dist: None,
            },
            spotter_left,
            spotter_right,
        };
    }

    let player_idx = player_car_idx as usize;
    let lap_dist_pct = &frame.car_idx_lap_dist_pct;
    let on_pit_road = &frame.car_idx_on_pit_road;

    let player_pct = match lap_dist_pct.get(player_idx) {
        Some(&p) if p >= 0.0 => p,
        _ => {
            return ProximityFrame {
                nearby_cars: vec![],
                radar_distances: RadarDistances {
                    front_dist: f32::INFINITY,
                    rear_dist: f32::INFINITY,
                    left_dist: None,
                    right_dist: None,
                },
                spotter_left,
                spotter_right,
            };
        }
    };

    let mut cars: Vec<(i32, f32)> = Vec::new();

    for (i, &pct) in lap_dist_pct.iter().enumerate() {
        if i == player_idx { continue; }
        if pct < 0.0 { continue; }
        if on_pit_road.get(i).copied().unwrap_or(false) { continue; }

        let mut diff = pct - player_pct;
        if diff > 0.5 { diff -= 1.0; }
        else if diff < -0.5 { diff += 1.0; }

        let lon_dist = diff * track_length_m;
        if lon_dist.abs() <= MAX_SEARCH_DIST_M {
            cars.push((i as i32, lon_dist));
        }
    }

    cars.sort_by(|a, b| a.1.abs().partial_cmp(&b.1.abs()).unwrap_or(std::cmp::Ordering::Equal));

    let nearby_cars: Vec<NearbyCar> = cars
        .iter()
        .map(|&(idx, lon_dist)| {
            let clearance = lon_dist.abs();
            let is_alongside = clearance < ALONGSIDE_THRESHOLD_M;
            let lateral_side = if is_alongside {
                if has_left && has_right {
                    if lon_dist >= 0.0 { LateralSide::Right } else { LateralSide::Left }
                } else if has_left {
                    LateralSide::Left
                } else if has_right {
                    LateralSide::Right
                } else if car_left_right == CLR_OFF {
                    if lon_dist >= 0.0 { LateralSide::Left } else { LateralSide::Right }
                } else {
                    LateralSide::Center
                }
            } else {
                LateralSide::Center
            };

            NearbyCar { car_idx: idx, longitudinal_dist: lon_dist, lateral_side, clearance }
        })
        .collect();

    let radar_distances = compute_radar_distances(&nearby_cars, spotter_left, spotter_right);

    ProximityFrame { nearby_cars, radar_distances, spotter_left, spotter_right }
}

fn compute_radar_distances(cars: &[NearbyCar], spotter_left: bool, spotter_right: bool) -> RadarDistances {
    let mut left_dist: Option<f32> = None;
    let mut right_dist: Option<f32> = None;
    let mut left_idx: i32 = -1;
    let mut right_idx: i32 = -1;
    let mut left_clearance = f32::INFINITY;
    let mut right_clearance = f32::INFINITY;

    if spotter_left || spotter_right {
        for car in cars {
            if spotter_left && car.lateral_side == LateralSide::Left && car.clearance < left_clearance {
                left_clearance = car.clearance;
                left_dist = Some(car.longitudinal_dist);
                left_idx = car.car_idx;
            }
            if spotter_right && car.lateral_side == LateralSide::Right && car.clearance < right_clearance {
                right_clearance = car.clearance;
                right_dist = Some(car.longitudinal_dist);
                right_idx = car.car_idx;
            }
        }
    }

    let mut front_dist = f32::INFINITY;
    let mut rear_dist = f32::INFINITY;

    for car in cars {
        if car.car_idx == left_idx || car.car_idx == right_idx { continue; }

        if car.longitudinal_dist > BUMPER_THRESHOLD_M {
            let gap = (car.longitudinal_dist - CAR_LENGTH_M).max(0.0);
            front_dist = front_dist.min(gap);
        } else if car.longitudinal_dist < -BUMPER_THRESHOLD_M {
            let gap = (car.longitudinal_dist.abs() - CAR_LENGTH_M).max(0.0);
            rear_dist = rear_dist.min(gap);
        }
    }

    RadarDistances { front_dist, rear_dist, left_dist, right_dist }
}
