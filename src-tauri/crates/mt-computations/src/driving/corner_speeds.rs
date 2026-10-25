//! The reference lap's speeds through each corner — the entry, the apex and
//! the exit — and how far through it the car is.
//!
//! The corners are found in the reference lap's recorded speeds alone: the
//! entry is the peak the speed falls away from, the apex the lowest point it
//! climbs back out of, and the exit the speed a fixed distance past the apex.
//! A fall or a climb counts only past a margin, so a gear change or a kerb is
//! not taken for a corner; a speed that falls away again short of the exit is
//! a chicane, which ends on the peak it reached and starts the next corner.
//!
//! With a reference, nothing is read off the car's own driving but where it is
//! on the lap: each point lights up as the car passes the reference's position
//! for it, so the moment is the same every lap. Once the corner is left the
//! next one's figures are up, however far ahead it is.
//!
//! With none, the same detector reads the car's own speed, and the figures are
//! its own, each lit as the car gets to it; a stop breaks the corner off.

use std::sync::Arc;

use serde::Serialize;

use crate::{ComputeContext, ComputedOutput, Processor, ProcessorCommand, ProcessorId, TickRate};
use mt_model::computed::reference_lap::ReferenceLapData;
use mt_model::contract::capabilities::Capabilities;

/// How far the speed must fall from a peak, or climb from a low, to count —
/// 8 km/h, past a gear change or a kerb, m/s.
const SPEED_MARGIN_MPS: f32 = 2.2;
/// Below this the car has stopped rather than taken a corner — 25 km/h, m/s.
const STOPPED_MPS: f32 = 7.0;
/// How far past the apex the exit speed is taken.
const EXIT_DISTANCE_M: f32 = 100.0;
/// How long the exit stays lit before the next corner's figures replace it.
const HOLD_M: f32 = 50.0;
/// Two corners whose apexes lie closer than this are one found twice.
const SAME_APEX_M: f32 = 50.0;
/// The distances above as a share of the lap, when the track length is unknown.
const FALLBACK_EXIT_PCT: f32 = 0.02;
const FALLBACK_HOLD_PCT: f32 = 0.01;
const FALLBACK_SAME_APEX_PCT: f32 = 0.005;
/// One corner's three speeds, m/s.
#[derive(Debug, Clone, Copy, PartialEq)]
struct CornerSpeeds {
    pub entry: f32,
    pub apex: f32,
    pub exit: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Default)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct CornerSpeedsFrame {
    /// The speeds of the corner the car is in, or the next one, m/s. With no
    /// reference the car's own, each `None` until the car has one for it — the
    /// apex is the lowest so far until it is passed.
    pub entry: Option<f32>,
    pub apex: Option<f32>,
    pub exit: Option<f32>,
    pub entry_passed: bool,
    pub apex_passed: bool,
    pub exit_passed: bool,
    /// Whether the speeds are the reference lap's rather than the car's own.
    pub from_reference: bool,
}

impl CornerSpeedsFrame {
    fn of(speeds: CornerSpeeds, from_reference: bool) -> Self {
        Self {
            entry: Some(speeds.entry),
            apex: Some(speeds.apex),
            exit: Some(speeds.exit),
            from_reference,
            ..Self::default()
        }
    }
}

/// A corner and where on the lap each of its points lies.
#[derive(Debug, Clone, Copy, PartialEq)]
struct CornerRecord {
    entry_pct: f32,
    apex_pct: f32,
    exit_pct: f32,
    speeds: CornerSpeeds,
}

/// A speed and where on the lap the car had it.
#[derive(Debug, Clone, Copy)]
struct SpeedPoint {
    speed: f32,
    lap_pct: f32,
}

#[derive(Debug, Clone, Copy)]
struct ActiveCorner {
    entry: SpeedPoint,
    apex: SpeedPoint,
    apex_passed: bool,
    /// The fastest point since the apex: a chicane's next entry.
    peak_since_apex: SpeedPoint,
}

impl ActiveCorner {
    fn open(entry: SpeedPoint, here: SpeedPoint) -> Self {
        Self {
            entry,
            apex: here,
            apex_passed: false,
            peak_since_apex: here,
        }
    }

    fn record(&self, exit: SpeedPoint) -> CornerRecord {
        CornerRecord {
            entry_pct: self.entry.lap_pct,
            apex_pct: self.apex.lap_pct,
            exit_pct: exit.lap_pct,
            speeds: CornerSpeeds {
                entry: self.entry.speed,
                apex: self.apex.speed,
                exit: exit.speed,
            },
        }
    }
}

/// Where the lap is measured in metres, or in shares of it when the length is
/// unknown.
#[derive(Debug, Clone, Copy)]
struct Track {
    length_m: f32,
}

impl Track {
    fn share(&self, metres: f32, fallback_pct: f32) -> f32 {
        if self.length_m > 0.0 {
            metres / self.length_m
        } else {
            fallback_pct
        }
    }
}

/// How far `to` lies ahead of `from`, wrapping over the line, as a share of the lap.
fn ahead(from: f32, to: f32) -> f32 {
    (to - from).rem_euclid(1.0)
}

/// How far `to` lies past `from` — negative while it is still behind — within
/// half a lap either way, as a share of the lap.
fn past(from: f32, to: f32) -> f32 {
    (to - from + 0.5).rem_euclid(1.0) - 0.5
}

/// Finds corners in a stream of speeds, one point at a time.
#[derive(Debug, Default)]
struct CornerDetector {
    /// The fastest point since the last corner; `None` before the first point.
    peak: Option<SpeedPoint>,
    active: Option<ActiveCorner>,
}

impl CornerDetector {
    /// Feeds one point; returns a corner when this point finished one.
    fn feed(&mut self, here: SpeedPoint, track: Track) -> Option<CornerRecord> {
        match self.active.take() {
            Some(mut active) if !active.apex_passed => {
                if here.speed < active.apex.speed {
                    active.apex = here;
                } else if here.speed >= active.apex.speed + SPEED_MARGIN_MPS {
                    active.apex_passed = true;
                    active.peak_since_apex = here;
                }

                self.active = Some(active);

                None
            }
            Some(mut active) => {
                if here.speed > active.peak_since_apex.speed {
                    active.peak_since_apex = here;
                }

                let peak = active.peak_since_apex;

                if here.speed <= peak.speed - SPEED_MARGIN_MPS {
                    // A chicane: the speed fell away again short of the exit.
                    self.active = Some(ActiveCorner::open(peak, here));

                    return Some(active.record(peak));
                }

                let exit_share = track.share(EXIT_DISTANCE_M, FALLBACK_EXIT_PCT);

                if ahead(active.apex.lap_pct, here.lap_pct) >= exit_share {
                    self.peak = Some(here);

                    return Some(active.record(here));
                }

                self.active = Some(active);

                None
            }
            None => {
                match self.peak {
                    Some(peak) if here.speed <= peak.speed - SPEED_MARGIN_MPS => {
                        self.peak = None;
                        self.active = Some(ActiveCorner::open(peak, here));
                    }
                    // The last point at the top: where the speed starts to fall.
                    Some(peak) if here.speed < peak.speed => {}
                    _ => self.peak = Some(here),
                }

                None
            }
        }
    }
}

/// The reference lap's corners in lap order.
///
/// The scan starts at the fastest point of the lap, which is on a straight, and
/// goes once round and on through the corner it ends in, so a corner over the
/// line is found whole.
fn reference_corners(reference: &ReferenceLapData, track: Track) -> Vec<CornerRecord> {
    let samples = &reference.samples;
    let bucket_count = samples.len();

    let Some(start) = samples
        .iter()
        .enumerate()
        .max_by(|(_, first), (_, second)| first.speed.total_cmp(&second.speed))
        .map(|(index, _)| index)
    else {
        return Vec::new();
    };

    let mut detector = CornerDetector::default();
    let mut corners: Vec<CornerRecord> = Vec::new();

    for step in 0..bucket_count * 2 {
        let index = (start + step) % bucket_count;
        let here = SpeedPoint {
            speed: samples[index].speed,
            lap_pct: (index as f32 + 0.5) / bucket_count as f32,
        };

        if let Some(corner) = detector.feed(here, track) {
            corners.push(corner);
        }

        if step >= bucket_count && detector.active.is_none() {
            break;
        }
    }

    // The second time round can find the first corner again.
    let same_apex = track.share(SAME_APEX_M, FALLBACK_SAME_APEX_PCT);

    if let [first, .., last] = corners.as_slice() {
        if past(first.apex_pct, last.apex_pct).abs() < same_apex {
            corners.pop();
        }
    }

    corners.sort_by(|first, second| first.entry_pct.total_cmp(&second.entry_pct));

    corners
}

#[derive(Default)]
pub struct CornerSpeedsProcessor {
    reference: Option<Arc<ReferenceLapData>>,
    /// The reference's corners, found again whenever the track length changes.
    corners: Option<Vec<CornerRecord>>,
    /// The track length the corners were found with; 0 while it is unknown.
    corners_length_m: f32,
    /// Reads the car's own corners while there is no reference.
    detector: CornerDetector,
    /// The car's own corner finished last.
    own_last: Option<CornerRecord>,
}

impl CornerSpeedsProcessor {
    fn frame(&mut self, speed: f32, lap_pct: f32, track: Track) -> CornerSpeedsFrame {
        if self.corners.is_none() || self.corners_length_m != track.length_m {
            self.corners_length_m = track.length_m;
            self.corners = self
                .reference
                .as_deref()
                .map(|reference| reference_corners(reference, track));
        }

        match self.corners.as_deref() {
            Some(corners) if !corners.is_empty() => reference_frame(corners, lap_pct, track),
            _ => self.own_frame(speed, lap_pct, track),
        }
    }

    /// No reference: the car's own corner, as far as it has got through it.
    fn own_frame(&mut self, speed: f32, lap_pct: f32, track: Track) -> CornerSpeedsFrame {
        if speed < STOPPED_MPS {
            self.forget_own();
        }

        let here = SpeedPoint { speed, lap_pct };

        if let Some(corner) = self.detector.feed(here, track) {
            self.own_last = Some(corner);
        }

        if let Some(active) = self.detector.active {
            return CornerSpeedsFrame {
                entry: Some(active.entry.speed),
                apex: Some(active.apex.speed),
                exit: None,
                entry_passed: true,
                apex_passed: active.apex_passed,
                exit_passed: false,
                from_reference: false,
            };
        }

        match self.own_last {
            Some(corner) => CornerSpeedsFrame {
                entry_passed: true,
                apex_passed: true,
                exit_passed: true,
                ..CornerSpeedsFrame::of(corner.speeds, false)
            },
            None => CornerSpeedsFrame::default(),
        }
    }

    fn forget_own(&mut self) {
        self.detector = CornerDetector::default();
        self.own_last = None;
    }
}

/// The reference corner the car is in, or the next one.
fn reference_frame(corners: &[CornerRecord], lap_pct: f32, track: Track) -> CornerSpeedsFrame {
    let hold = track.share(HOLD_M, FALLBACK_HOLD_PCT);

    // The corner the car is in: past its entry and not yet past the hold
    // after its exit. Of two, the one entered last.
    let inside = corners
        .iter()
        .map(|corner| (past(corner.entry_pct, lap_pct), corner))
        .filter(|(since_entry, corner)| {
            *since_entry >= 0.0 && past(corner.exit_pct, lap_pct) < hold
        })
        .min_by(|(first, _), (second, _)| first.total_cmp(second))
        .map(|(_, corner)| corner);

    if let Some(corner) = inside {
        return CornerSpeedsFrame {
            entry_passed: true,
            apex_passed: past(corner.apex_pct, lap_pct) >= 0.0,
            exit_passed: past(corner.exit_pct, lap_pct) >= 0.0,
            ..CornerSpeedsFrame::of(corner.speeds, true)
        };
    }

    corners
        .iter()
        .min_by(|first, second| {
            ahead(lap_pct, first.entry_pct).total_cmp(&ahead(lap_pct, second.entry_pct))
        })
        .map(|corner| CornerSpeedsFrame::of(corner.speeds, true))
        .unwrap_or_default()
}

impl Processor for CornerSpeedsProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::CornerSpeeds
    }

    fn required(&self) -> Capabilities {
        Capabilities::empty()
    }

    fn rate(&self) -> TickRate {
        TickRate::OverlayClock
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        let lap_pct = ctx.lap_timing.lap_dist_pct.filter(|pct| *pct >= 0.0)?;
        let track = Track {
            length_m: ctx.track_length_m,
        };

        // In the pits or off the track the car's own corner is broken off.
        let is_off_track =
            ctx.car_status.is_on_track == Some(false) || ctx.car_status.on_pit_road == Some(true);

        if is_off_track {
            self.forget_own();
        }

        let frame = self.frame(ctx.car_dynamics.speed, lap_pct, track);

        Some(ComputedOutput::CornerSpeeds(frame))
    }

    fn reset(&mut self) {
        self.corners = None;
        self.forget_own();
    }

    fn command(&mut self, command: &ProcessorCommand) {
        if let ProcessorCommand::ActiveReference(reference) = command {
            self.reference = reference.clone();
            self.corners = None;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mt_model::computed::reference_lap::{ReferenceLapSample, TrackCondition};

    const TRACK: Track = Track { length_m: 1000.0 };
    const BUCKETS: usize = 1000;

    fn sample(speed: f32) -> ReferenceLapSample {
        ReferenceLapSample {
            speed,
            throttle: 0.0,
            brake: 0.0,
            lat_accel: None,
            long_accel: None,
            steering_wheel_angle: 0.0,
        }
    }

    /// Straights at 60 m/s, and per `(start, apex)` a corner braking from
    /// `start` down to `apex` m/s at 10 % of the lap later, then back up over 15 %.
    fn lap_speeds(corners: &[(f32, f32)]) -> Vec<f32> {
        (0..BUCKETS)
            .map(|index| {
                let pct = (index as f32 + 0.5) / BUCKETS as f32;

                corners
                    .iter()
                    .map(|(start, apex)| {
                        let into = pct - start;

                        if (0.0..0.1).contains(&into) {
                            60.0 - (60.0 - apex) * into / 0.1
                        } else if (0.1..0.25).contains(&into) {
                            apex + (60.0 - apex) * (into - 0.1) / 0.15
                        } else {
                            60.0
                        }
                    })
                    .fold(60.0, f32::min)
            })
            .collect()
    }

    fn processor(corners: &[(f32, f32)]) -> CornerSpeedsProcessor {
        let mut processor = CornerSpeedsProcessor::default();

        processor.command(&ProcessorCommand::ActiveReference(Some(Arc::new(
            ReferenceLapData {
                track_id: 1,
                car_screen_name: String::new(),
                lap_time: 60.0,
                samples: lap_speeds(corners).into_iter().map(sample).collect(),
                condition: TrackCondition::default(),
                recorded_wetness: None,
                recorded_tire_wear: None,
                recorded_fuel_level: None,
            },
        ))));

        processor
    }

    #[test]
    fn the_reference_corner_is_found_from_its_speeds() {
        let mut processor = processor(&[(0.2, 30.0)]);

        processor.frame(60.0, 0.0, TRACK);

        let corners = processor.corners.unwrap();

        assert_eq!(corners.len(), 1);

        let corner = corners[0];

        assert_eq!(corner.speeds.entry, 60.0);
        assert!((corner.speeds.apex - 30.0).abs() < 0.5);
        assert!((corner.apex_pct - 0.3).abs() < 0.005);
        assert!((corner.exit_pct - 0.4).abs() < 0.005);
        assert!((corner.speeds.exit - 50.0).abs() < 1.0);
    }

    #[test]
    fn each_point_lights_up_at_the_reference_position() {
        let mut processor = processor(&[(0.2, 30.0)]);

        let approach = processor.frame(60.0, 0.1, TRACK);

        assert!((approach.apex.unwrap() - 30.0).abs() < 0.5);
        assert!(approach.from_reference);
        assert!(!approach.entry_passed);

        let braking = processor.frame(60.0, 0.25, TRACK);

        assert!(braking.entry_passed && !braking.apex_passed);

        let past_apex = processor.frame(60.0, 0.35, TRACK);

        assert!(past_apex.apex_passed && !past_apex.exit_passed);

        let exited = processor.frame(60.0, 0.42, TRACK);

        assert!(exited.exit_passed);
    }

    #[test]
    fn the_next_corner_is_up_as_soon_as_the_exit_is_held() {
        let mut processor = processor(&[(0.1, 30.0), (0.6, 20.0)]);

        let after = processor.frame(60.0, 0.5, TRACK);

        assert!((after.apex.unwrap() - 20.0).abs() < 0.5);
        assert!(!after.entry_passed);
    }

    #[test]
    fn without_a_reference_the_car_reads_its_own_corner() {
        let mut processor = CornerSpeedsProcessor::default();
        let speeds = lap_speeds(&[(0.2, 25.0)]);
        let frames: Vec<CornerSpeedsFrame> = speeds
            .iter()
            .enumerate()
            .map(|(index, speed)| processor.frame(*speed, index as f32 / BUCKETS as f32, TRACK))
            .collect();

        assert_eq!(frames[100], CornerSpeedsFrame::default());

        let braking = &frames[280];

        assert!(!braking.from_reference);
        assert!(braking.entry_passed && !braking.apex_passed);
        assert_eq!(braking.entry, Some(60.0));
        assert_eq!(braking.exit, None);

        let exited = &frames[500];

        assert!(exited.exit_passed);
        assert!((exited.apex.unwrap() - 25.0).abs() < 0.5);
    }

    #[test]
    fn without_a_reference_a_stop_breaks_the_corner_off() {
        let mut processor = CornerSpeedsProcessor::default();

        for (index, speed) in [60.0, 60.0, 40.0, 20.0, 3.0, 0.0].iter().enumerate() {
            processor.frame(*speed, index as f32 / BUCKETS as f32, TRACK);
        }

        assert_eq!(
            processor.frame(0.0, 0.01, TRACK),
            CornerSpeedsFrame::default()
        );
    }

    #[test]
    fn the_reference_corners_are_found_again_once_the_track_length_is_known() {
        let mut processor = processor(&[(0.2, 30.0)]);

        processor.frame(60.0, 0.0, Track { length_m: 0.0 });

        let unknown_exit = processor.corners.as_ref().unwrap()[0].exit_pct;

        processor.frame(60.0, 0.0, Track { length_m: 2000.0 });

        let known_exit = processor.corners.as_ref().unwrap()[0].exit_pct;

        assert!((unknown_exit - 0.32).abs() < 0.005);
        assert!((known_exit - 0.35).abs() < 0.005);
    }

    #[test]
    fn a_chicane_is_two_corners() {
        let mut detector = CornerDetector::default();
        let speeds = [
            60.0, 60.0, 50.0, 40.0, 30.0, 33.0, 36.0, 34.0, 31.0, 28.0, 35.0, 45.0,
        ];
        let corners: Vec<CornerRecord> = speeds
            .iter()
            .enumerate()
            .filter_map(|(index, speed)| {
                detector.feed(
                    SpeedPoint {
                        speed: *speed,
                        lap_pct: index as f32 / BUCKETS as f32,
                    },
                    TRACK,
                )
            })
            .collect();

        assert_eq!(corners.len(), 1);
        assert_eq!(corners[0].speeds.exit, 36.0);
        assert_eq!(
            detector.active.expect("the second corner").entry.speed,
            36.0
        );
    }
}
