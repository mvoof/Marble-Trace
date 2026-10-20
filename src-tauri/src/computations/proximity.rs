use crate::capabilities::Capabilities;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use crate::model::cars::{CarIdxFrame, PaceFormation, PacingFrame, SpotterState};
use crate::model::session::SessionSnapshot;
use serde::{Deserialize, Serialize};

const MAX_SEARCH_DIST_M: f32 = 50.0;
const ALONGSIDE_THRESHOLD_M: f32 = 5.0;
const BUMPER_THRESHOLD_M: f32 = 2.2;

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum LateralSide {
    Left,
    Right,
    Center,
    /// In the next column of a pace formation. The sim names the column but
    /// not the side it runs on, and that side changes from track to track, so
    /// the car is beside the player's lane without being placed left or right.
    OtherColumn,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NearbyCar {
    pub car_idx: i32,
    /// Positive = ahead, negative = behind (meters)
    pub longitudinal_dist: f32,
    pub lateral_side: LateralSide,
    /// Absolute longitudinal distance in meters
    pub clearance: f32,
    /// Longitudinal distance from bumper to bumper, in meters: `clearance`
    /// less one car length, floored at zero. Signed like `longitudinal_dist`.
    ///
    /// This is the number a driver means by "how far is he" — two cars nose to
    /// tail read `0` here and a car length apart in `clearance`. One car length
    /// serves for every car on track, so in a multiclass field it is an
    /// estimate; the reference point iRacing reports is not exactly the centre
    /// of the body either. Both are far closer to the truth than centre to
    /// centre.
    pub bumper_dist: f32,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RadarDistances {
    /// Bumper gap to the nearest car ahead, in meters. `None` when there is none.
    pub front_dist: Option<f32>,
    /// Bumper gap to the nearest car behind, in meters. `None` when there is none.
    pub rear_dist: Option<f32>,
    pub left_dist: Option<f32>,
    pub right_dist: Option<f32>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProximityFrame {
    pub nearby_cars: Vec<NearbyCar>,
    pub radar_distances: RadarDistances,
    pub spotter_left: bool,
    pub spotter_right: bool,
    /// The field is lined up behind the pace car. A car that close is where it
    /// should be rather than a threat — the widgets drop their warnings while
    /// this holds — and the next column is `OtherColumn`, on no side.
    pub formation: bool,
}

/// Stateless processor wrapping the proximity computation.
pub struct ProximityProcessor;

impl Processor for ProximityProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::Proximity
    }

    fn required(&self) -> Capabilities {
        Capabilities::RADAR
    }

    fn rate(&self) -> TickRate {
        TickRate::OverlayClock
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        let frame = compute(
            ctx.car_idx,
            ctx.pacing,
            ctx.session,
            ctx.track_length_m,
            ctx.car_length_m,
        );

        Some(ComputedOutput::Proximity(frame))
    }

    fn reset(&mut self) {}
}

pub fn parse_track_length(s: &str) -> f32 {
    let s = s.trim().to_lowercase();
    let s = s.as_str();

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

fn spotter_flags(spotter: SpotterState) -> (bool, bool) {
    let left = matches!(
        spotter,
        SpotterState::CarLeft | SpotterState::CarLeftRight | SpotterState::TwoCarsLeft
    );

    let right = matches!(
        spotter,
        SpotterState::CarRight | SpotterState::CarLeftRight | SpotterState::TwoCarsRight
    );

    (left, right)
}

/// The player's place in a pace formation.
struct Formation {
    double_file: bool,
    player_line: i32,
}

/// `None` unless the player has a column. The sim keeps reporting a start
/// formation well into some races; only an assigned line means the field is
/// actually lined up.
fn formation_of(pacing: &PacingFrame, player_idx: usize) -> Option<Formation> {
    let double_file = match pacing.formation {
        PaceFormation::NotPacing => return None,
        PaceFormation::SingleFile => false,
        PaceFormation::DoubleFile => true,
    };

    let player_line = *pacing.car_idx_pace_line.get(player_idx)?;

    if player_line < 0 {
        return None;
    }

    Some(Formation {
        double_file,
        player_line,
    })
}

/// The sim does not say which side the pole column is on, and no rule fits
/// every track: both are road courses, yet the pole line ran on the left at
/// the Charlotte Roval and on the right at Spa (AI races, 2026-10-20). The
/// spotter is silent while pacing, so nothing tells the side — the next
/// column is `OtherColumn`. Tracks are being checked for a rule in
/// https://github.com/mvoof/Marble-Trace/issues/612.
fn formation_side(formation: &Formation, line: i32) -> LateralSide {
    if !formation.double_file || line < 0 || line == formation.player_line {
        return LateralSide::Center;
    }

    LateralSide::OtherColumn
}

/// Puts on each side as many cars as the spotter calls there, nearest first.
///
/// `cars` is sorted nearest first, so the ones alongside lead it. Three wide,
/// the two nearest take one side each — the further ahead of them the right —
/// so both sides the spotter calls are drawn. A spotter that is off or clear
/// places nobody: a side is never guessed from geometry alone.
fn spotter_sides(spotter: SpotterState, cars: &[(i32, f32)]) -> Vec<LateralSide> {
    let mut sides = vec![LateralSide::Center; cars.len()];
    let alongside = cars
        .iter()
        .take_while(|(_, lon_dist)| lon_dist.abs() < ALONGSIDE_THRESHOLD_M)
        .count();

    let mut fill = |count: usize, side: LateralSide| {
        for slot in sides.iter_mut().take(count.min(alongside)) {
            *slot = side.clone();
        }
    };

    match spotter {
        SpotterState::CarLeft => fill(1, LateralSide::Left),
        SpotterState::TwoCarsLeft => fill(2, LateralSide::Left),
        SpotterState::CarRight => fill(1, LateralSide::Right),
        SpotterState::TwoCarsRight => fill(2, LateralSide::Right),
        SpotterState::CarLeftRight => match alongside {
            0 => {}
            1 => {
                sides[0] = if cars[0].1 >= 0.0 {
                    LateralSide::Right
                } else {
                    LateralSide::Left
                };
            }
            _ => {
                let (ahead, behind) = if cars[0].1 >= cars[1].1 {
                    (0, 1)
                } else {
                    (1, 0)
                };

                sides[ahead] = LateralSide::Right;
                sides[behind] = LateralSide::Left;
            }
        },
        SpotterState::Off | SpotterState::Clear => {}
    }

    sides
}

fn empty_frame(spotter_left: bool, spotter_right: bool) -> ProximityFrame {
    ProximityFrame {
        nearby_cars: vec![],
        radar_distances: RadarDistances {
            front_dist: None,
            rear_dist: None,
            left_dist: None,
            right_dist: None,
        },
        spotter_left,
        spotter_right,
        formation: false,
    }
}

pub fn compute(
    car_idx: &CarIdxFrame,
    pacing: &PacingFrame,
    session: &SessionSnapshot,
    track_length_m: f32,
    car_length_m: f32,
) -> ProximityFrame {
    let player_idx = session.player_car_idx;

    let spotter = car_idx.spotter.unwrap_or(SpotterState::Clear);
    let (spotter_left, spotter_right) = spotter_flags(spotter);

    if player_idx < 0 || track_length_m <= 0.0 {
        return empty_frame(spotter_left, spotter_right);
    }

    let player_idx = player_idx as usize;
    let lap_dist_pct = &car_idx.car_idx_lap_dist_pct;
    let on_pit_road = &car_idx.car_idx_on_pit_road;

    let player_pct = match lap_dist_pct.get(player_idx) {
        Some(&p) if p >= 0.0 => p,
        _ => return empty_frame(spotter_left, spotter_right),
    };

    let mut cars: Vec<(i32, f32)> = Vec::new();

    for (i, &pct) in lap_dist_pct.iter().enumerate() {
        if i == player_idx {
            continue;
        }

        if pct < 0.0 {
            continue;
        }

        if on_pit_road.get(i).copied().unwrap_or(false) {
            continue;
        }

        let mut diff = pct - player_pct;

        if diff > 0.5 {
            diff -= 1.0;
        } else if diff < -0.5 {
            diff += 1.0;
        }

        let lon_dist = diff * track_length_m;

        if lon_dist.abs() <= MAX_SEARCH_DIST_M {
            cars.push((i as i32, lon_dist));
        }
    }

    cars.sort_by(|a, b| {
        a.1.abs()
            .partial_cmp(&b.1.abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let formation = formation_of(pacing, player_idx);

    let sides = match &formation {
        Some(formation) => cars
            .iter()
            .map(|&(idx, _)| {
                let line = pacing
                    .car_idx_pace_line
                    .get(idx as usize)
                    .copied()
                    .unwrap_or(-1);

                formation_side(formation, line)
            })
            .collect(),
        None => spotter_sides(spotter, &cars),
    };

    let nearby_cars: Vec<NearbyCar> = cars
        .iter()
        .zip(sides)
        .map(|(&(idx, lon_dist), lateral_side)| {
            let clearance = lon_dist.abs();

            NearbyCar {
                car_idx: idx,
                longitudinal_dist: lon_dist,
                lateral_side,
                clearance,
                bumper_dist: (clearance - car_length_m).max(0.0) * lon_dist.signum(),
            }
        })
        .collect();

    let radar_distances =
        compute_radar_distances(&nearby_cars, spotter_left, spotter_right, car_length_m);

    ProximityFrame {
        nearby_cars,
        radar_distances,
        spotter_left,
        spotter_right,
        formation: formation.is_some(),
    }
}

fn compute_radar_distances(
    cars: &[NearbyCar],
    spotter_left: bool,
    spotter_right: bool,
    car_length_m: f32,
) -> RadarDistances {
    let mut left_dist: Option<f32> = None;
    let mut right_dist: Option<f32> = None;
    let mut left_clearance: f32 = 999.0;
    let mut right_clearance: f32 = 999.0;

    if spotter_left || spotter_right {
        for car in cars {
            if spotter_left
                && car.lateral_side == LateralSide::Left
                && car.clearance < left_clearance
            {
                left_clearance = car.clearance;
                left_dist = Some(car.longitudinal_dist);
            }
            if spotter_right
                && car.lateral_side == LateralSide::Right
                && car.clearance < right_clearance
            {
                right_clearance = car.clearance;
                right_dist = Some(car.longitudinal_dist);
            }
        }
    }

    let mut front_dist: Option<f32> = None;
    let mut rear_dist: Option<f32> = None;

    // Ahead and behind are the player's own lane: a car in the next column of a
    // formation, or one the spotter has alongside, is neither.
    for car in cars {
        if car.lateral_side != LateralSide::Center {
            continue;
        }

        if car.longitudinal_dist > BUMPER_THRESHOLD_M {
            let gap = (car.longitudinal_dist - car_length_m).max(0.0);

            front_dist = Some(front_dist.map_or(gap, |nearest| nearest.min(gap)));
        } else if car.longitudinal_dist < -BUMPER_THRESHOLD_M {
            let gap = (car.longitudinal_dist.abs() - car_length_m).max(0.0);

            rear_dist = Some(rear_dist.map_or(gap, |nearest| nearest.min(gap)));
        }
    }

    RadarDistances {
        front_dist,
        rear_dist,
        left_dist,
        right_dist,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TRACK_M: f32 = 1000.0;
    const CAR_M: f32 = 4.5;
    const PLAYER: usize = 0;
    const PLAYER_PCT: f32 = 0.5;

    /// Cars at `offsets_m` metres from the player, who is car 0.
    fn car_idx_frame(offsets_m: &[f32], spotter: SpotterState) -> CarIdxFrame {
        let mut pcts = vec![PLAYER_PCT];
        pcts.extend(offsets_m.iter().map(|offset| PLAYER_PCT + offset / TRACK_M));

        CarIdxFrame {
            car_idx_on_pit_road: vec![false; pcts.len()],
            car_idx_lap_dist_pct: pcts,
            spotter: Some(spotter),
            ..Default::default()
        }
    }

    fn session() -> SessionSnapshot {
        SessionSnapshot {
            player_car_idx: PLAYER as i32,
            ..Default::default()
        }
    }

    fn run(car_idx: &CarIdxFrame, pacing: &PacingFrame) -> ProximityFrame {
        compute(car_idx, pacing, &session(), TRACK_M, CAR_M)
    }

    fn side_of(frame: &ProximityFrame, car: i32) -> LateralSide {
        frame
            .nearby_cars
            .iter()
            .find(|nearby| nearby.car_idx == car)
            .map(|nearby| nearby.lateral_side.clone())
            .expect("car in range")
    }

    #[test]
    fn a_spotter_that_is_off_places_nobody_on_a_side() {
        let frame = run(
            &car_idx_frame(&[2.0, -2.0], SpotterState::Off),
            &PacingFrame::default(),
        );

        assert_eq!(side_of(&frame, 1), LateralSide::Center);
        assert_eq!(side_of(&frame, 2), LateralSide::Center);
    }

    #[test]
    fn one_car_called_takes_only_the_nearest_alongside() {
        let frame = run(
            &car_idx_frame(&[1.0, 4.0], SpotterState::CarLeft),
            &PacingFrame::default(),
        );

        assert_eq!(side_of(&frame, 1), LateralSide::Left);
        assert_eq!(side_of(&frame, 2), LateralSide::Center);
    }

    #[test]
    fn three_wide_fills_both_sides_even_with_both_cars_ahead() {
        let frame = run(
            &car_idx_frame(&[1.0, 3.0], SpotterState::CarLeftRight),
            &PacingFrame::default(),
        );

        assert_eq!(side_of(&frame, 2), LateralSide::Right);
        assert_eq!(side_of(&frame, 1), LateralSide::Left);
        assert!(frame.radar_distances.left_dist.is_some());
        assert!(frame.radar_distances.right_dist.is_some());
    }

    #[test]
    fn a_double_file_formation_puts_the_other_column_on_no_side() {
        let pacing = PacingFrame {
            formation: PaceFormation::DoubleFile,
            // player in column 1; car 1 beside, car 2 ahead in line,
            // car 3 ahead in the pole column, which may run on either side
            car_idx_pace_line: vec![1, 0, 1, 0],
        };
        let frame = run(
            &car_idx_frame(&[0.5, 9.0, 9.5], SpotterState::Clear),
            &pacing,
        );

        assert!(frame.formation);
        assert_eq!(side_of(&frame, 1), LateralSide::OtherColumn);
        assert_eq!(side_of(&frame, 2), LateralSide::Center);
        assert_eq!(side_of(&frame, 3), LateralSide::OtherColumn);
        assert!(frame.radar_distances.left_dist.is_none());
        assert!(frame.radar_distances.right_dist.is_none());
        let front = frame.radar_distances.front_dist.expect("car ahead in line");
        assert!((front - (9.0 - CAR_M)).abs() < 0.01);
    }

    #[test]
    fn single_file_keeps_everyone_in_the_players_lane() {
        let pacing = PacingFrame {
            formation: PaceFormation::SingleFile,
            car_idx_pace_line: vec![0, 0, 0],
        };
        let frame = run(&car_idx_frame(&[1.0, -8.0], SpotterState::CarLeft), &pacing);

        assert!(frame.formation);
        assert_eq!(side_of(&frame, 1), LateralSide::Center);
        assert_eq!(side_of(&frame, 2), LateralSide::Center);
    }

    #[test]
    fn a_pace_mode_without_a_line_for_the_player_is_not_a_formation() {
        let pacing = PacingFrame {
            formation: PaceFormation::DoubleFile,
            car_idx_pace_line: vec![-1, 0],
        };
        let frame = run(&car_idx_frame(&[1.0], SpotterState::CarRight), &pacing);

        assert!(!frame.formation);
        assert_eq!(side_of(&frame, 1), LateralSide::Right);
    }
}
