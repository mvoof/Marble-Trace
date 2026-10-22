//! The player's speeds through each corner: the entry, the apex and the exit,
//! against the same corner on the reference lap.
//!
//! Read off the speed alone — no pedal decides anything. The entry is the peak
//! the speed falls away from, the apex the lowest point it climbs back out of,
//! and the exit the speed a fixed distance past the apex. A fall or a climb
//! counts only past a margin, so a gear change or a kerb is not taken for a
//! corner. A speed that falls away again short of the exit is a chicane: the
//! corner ends on the peak it reached, and the next one starts from it.
//!
//! The reference lap's corners are found by running its recorded speeds
//! through the same detector, so the two lists mean the same thing by a
//! corner. Its corners are what a corner *is*: a slowdown the reference has no
//! corner for — a stop, a yellow, a car ahead — is not one. They are also the
//! targets, known before the car gets there. With no reference a stop still
//! breaks off the corner in progress.

use std::sync::Arc;

use serde::Serialize;

use super::{ComputeContext, ComputedOutput, Processor, ProcessorCommand, ProcessorId, TickRate};
use crate::capabilities::Capabilities;
use crate::model::reference_lap::ReferenceLapData;

/// How far the speed must fall from a peak, or climb from a low, to count —
/// 8 km/h, past a gear change or a kerb, m/s.
const SPEED_MARGIN_MPS: f32 = 2.2;
/// Below this the car has stopped rather than taken a corner — 25 km/h, m/s.
const STOPPED_MPS: f32 = 7.0;
/// How far past the apex the exit speed is taken.
const EXIT_DISTANCE_M: f32 = 100.0;
/// How far from a reference corner's entry the car's may lie and be that corner.
const ENTRY_MATCH_M: f32 = 150.0;
/// How far from a reference corner's apex the car's may lie and be that corner.
const APEX_MATCH_M: f32 = 80.0;
/// How close to the next corner's entry its targets replace the corner just left.
const APPROACH_M: f32 = 250.0;
/// How long the corner just left stays up before the next one's targets, past
/// its exit — unless the next corner has started first.
const HOLD_M: f32 = 150.0;
/// The distances above as a share of the lap, when the track length is unknown.
const FALLBACK_EXIT_PCT: f32 = 0.02;
const FALLBACK_MATCH_PCT: f32 = 0.02;
const FALLBACK_APPROACH_PCT: f32 = 0.05;
const FALLBACK_HOLD_PCT: f32 = 0.03;

/// One corner's three speeds, m/s.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct CornerSpeeds {
    pub entry: f32,
    pub apex: f32,
    pub exit: f32,
}

/// The car's pass through a corner, as far as it has got.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct CornerPass {
    pub entry: f32,
    /// The lowest speed so far; final once `apex_passed`.
    pub apex: f32,
    pub apex_passed: bool,
    /// `None` until the car is the exit distance past the apex.
    pub exit: Option<f32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Default)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct CornerSpeedsFrame {
    /// The corner being driven, or the one just left; `None` on the approach
    /// to the next.
    pub current: Option<CornerPass>,
    /// The same corner on the reference lap — on the approach, the one ahead.
    pub target: Option<CornerSpeeds>,
}

/// A corner and where on the lap it was driven.
#[derive(Debug, Clone, Copy, PartialEq)]
struct CornerRecord {
    entry_pct: f32,
    apex_pct: f32,
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

    fn pass(&self) -> CornerPass {
        CornerPass {
            entry: self.entry.speed,
            apex: self.apex.speed,
            apex_passed: self.apex_passed,
            exit: None,
        }
    }

    fn record(&self, exit: f32) -> CornerRecord {
        CornerRecord {
            entry_pct: self.entry.lap_pct,
            apex_pct: self.apex.lap_pct,
            speeds: CornerSpeeds {
                entry: self.entry.speed,
                apex: self.apex.speed,
                exit,
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

/// The distance between two lap positions either way round, as a share of the lap.
fn gap(first: f32, second: f32) -> f32 {
    let forward = ahead(first, second);

    forward.min(1.0 - forward)
}

/// Finds corners in a stream of speeds, one point at a time.
#[derive(Debug, Default)]
struct CornerDetector {
    /// The fastest point since the last corner; `None` until the car moves.
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

                    return Some(active.record(peak.speed));
                }

                let exit_share = track.share(EXIT_DISTANCE_M, FALLBACK_EXIT_PCT);

                if ahead(active.apex.lap_pct, here.lap_pct) >= exit_share {
                    self.peak = Some(here);

                    return Some(active.record(here.speed));
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

    fn abandon(&mut self) {
        *self = Self::default();
    }
}

/// The reference lap's corners, found by the same detector the car is read by.
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
    let mut corners = Vec::new();

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

    // Past the first round a corner the scan already has can be found again.
    corners.dedup_by(|later, earlier| gap(later.apex_pct, earlier.apex_pct) < f32::EPSILON);

    if corners.len() > 1 {
        let first = corners[0];
        let last = corners[corners.len() - 1];

        if gap(first.apex_pct, last.apex_pct) < track.share(APEX_MATCH_M, FALLBACK_MATCH_PCT) {
            corners.pop();
        }
    }

    corners
}

/// What one tick tells the processor.
#[derive(Debug, Clone, Copy)]
struct TickInput {
    speed: f32,
    lap_pct: f32,
    track: Track,
}

/// How far `to` lies past `from` — negative while it is still behind — within
/// half a lap either way, as a share of the lap.
fn past(from: f32, to: f32) -> f32 {
    (to - from + 0.5).rem_euclid(1.0) - 0.5
}

/// The car's pass through one reference corner.
#[derive(Debug, Clone, Copy)]
struct TrackedCorner {
    /// Index into the reference's corners.
    index: usize,
    /// The fastest the car has gone since it started on this corner.
    peak: f32,
    /// The entry, once the speed has fallen away from the peak.
    entry: Option<f32>,
    apex: SpeedPoint,
    apex_passed: bool,
    exit: Option<f32>,
}

impl TrackedCorner {
    fn new(index: usize, speed: f32) -> Self {
        Self {
            index,
            peak: speed,
            entry: None,
            apex: SpeedPoint {
                speed,
                lap_pct: 0.0,
            },
            apex_passed: false,
            exit: None,
        }
    }

    fn pass(&self) -> Option<CornerPass> {
        Some(CornerPass {
            entry: self.entry?,
            apex: self.apex.speed,
            apex_passed: self.apex_passed,
            exit: self.exit,
        })
    }

    /// Takes one point of the car's pass through `corner`.
    fn feed(&mut self, here: SpeedPoint, corner: &CornerRecord, track: Track) {
        let entry_window = track.share(ENTRY_MATCH_M, FALLBACK_MATCH_PCT);
        let apex_window = track.share(APEX_MATCH_M, FALLBACK_MATCH_PCT);

        if self.exit.is_some() {
            return;
        }

        if self.entry.is_none() {
            self.peak = self.peak.max(here.speed);

            let is_near_entry = past(corner.entry_pct, here.lap_pct) >= -entry_window;

            if is_near_entry && here.speed <= self.peak - SPEED_MARGIN_MPS {
                self.entry = Some(self.peak);
                self.apex = here;
            }

            return;
        }

        if !self.apex_passed {
            if here.speed < self.apex.speed {
                self.apex = here;
            }

            // A climb short of the reference's apex is a bump on the way in.
            let is_near_apex = past(corner.apex_pct, here.lap_pct) >= -apex_window;

            if is_near_apex && here.speed >= self.apex.speed + SPEED_MARGIN_MPS {
                self.apex_passed = true;
            }

            return;
        }

        let exit_share = track.share(EXIT_DISTANCE_M, FALLBACK_EXIT_PCT);

        if past(self.apex.lap_pct, here.lap_pct) >= exit_share {
            self.exit = Some(here.speed);
        }
    }

    /// Whether the car is so far past the corner that it is over, however far
    /// the pass got — a corner taken flat, or never climbed out of.
    fn is_left_behind(&self, corner: &CornerRecord, lap_pct: f32, track: Track) -> bool {
        let over = track.share(EXIT_DISTANCE_M * 3.0, FALLBACK_EXIT_PCT * 3.0);

        self.exit.is_none() && past(corner.apex_pct, lap_pct) >= over
    }
}

#[derive(Default)]
pub struct CornerSpeedsProcessor {
    /// Reads the car with no reference to go by.
    detector: CornerDetector,
    /// The corner the detector finished last.
    detected: Option<CornerRecord>,
    reference: Option<Arc<ReferenceLapData>>,
    /// The reference's corners, in lap order, found once the track length is known.
    targets: Option<Vec<CornerRecord>>,
    tracked: Option<TrackedCorner>,
    /// The reference corner finished last, the car's pass through it, and
    /// where on the lap it finished.
    finished: Option<(CornerPass, CornerSpeeds, f32)>,
}

impl CornerSpeedsProcessor {
    fn load_targets(&mut self, track: Track) {
        if self.targets.is_none() {
            self.targets = self.reference.as_deref().map(|reference| {
                let mut corners = reference_corners(reference, track);

                corners.sort_by(|first, second| first.entry_pct.total_cmp(&second.entry_pct));

                corners
            });
        }
    }

    /// The reference corner whose entry is the next one the car comes to.
    fn next_target(targets: &[CornerRecord], lap_pct: f32, track: Track) -> Option<usize> {
        let entry_window = track.share(ENTRY_MATCH_M, FALLBACK_MATCH_PCT);

        targets
            .iter()
            .enumerate()
            .map(|(index, corner)| (ahead(lap_pct, corner.entry_pct - entry_window), index))
            .min_by(|(first, _), (second, _)| first.total_cmp(second))
            .map(|(_, index)| index)
    }

    fn step(&mut self, input: TickInput) -> CornerSpeedsFrame {
        let track = input.track;

        self.load_targets(track);

        match self.targets.take() {
            Some(targets) if !targets.is_empty() => {
                let frame = self.step_on_reference(&targets, input);

                self.targets = Some(targets);

                frame
            }
            targets => {
                self.targets = targets;

                self.step_unaided(input)
            }
        }
    }

    fn step_on_reference(
        &mut self,
        targets: &[CornerRecord],
        input: TickInput,
    ) -> CornerSpeedsFrame {
        let track = input.track;
        let here = SpeedPoint {
            speed: input.speed,
            lap_pct: input.lap_pct,
        };

        if input.speed < STOPPED_MPS {
            self.tracked = None;
        }

        let mut tracked = match self.tracked {
            Some(tracked) => tracked,
            None => {
                let Some(index) = Self::next_target(targets, input.lap_pct, track) else {
                    return CornerSpeedsFrame::default();
                };

                TrackedCorner::new(index, input.speed)
            }
        };

        let corner = &targets[tracked.index];

        tracked.feed(here, corner, track);

        let is_done =
            tracked.exit.is_some() || tracked.is_left_behind(corner, input.lap_pct, track);

        if is_done {
            if let Some(mut pass) = tracked.pass() {
                if pass.exit.is_none() {
                    pass.apex_passed = true;
                    pass.exit = Some(input.speed);
                }

                self.finished = Some((pass, corner.speeds, input.lap_pct));
            }

            let next = (tracked.index + 1) % targets.len();

            tracked = TrackedCorner::new(next, input.speed);
        }

        self.tracked = Some(tracked);

        let corner = &targets[tracked.index];

        if let Some(pass) = tracked.pass() {
            return CornerSpeedsFrame {
                current: Some(pass),
                target: Some(corner.speeds),
            };
        }

        let approach = track.share(APPROACH_M, FALLBACK_APPROACH_PCT);
        let hold = track.share(HOLD_M, FALLBACK_HOLD_PCT);
        let is_holding = self
            .finished
            .is_some_and(|(_, _, finished_at)| past(finished_at, input.lap_pct) < hold);

        if !is_holding && past(input.lap_pct, corner.entry_pct) <= approach {
            return CornerSpeedsFrame {
                current: None,
                target: Some(corner.speeds),
            };
        }

        match self.finished {
            Some((pass, target, _)) => CornerSpeedsFrame {
                current: Some(pass),
                target: Some(target),
            },
            None => CornerSpeedsFrame::default(),
        }
    }

    /// No reference: the corners are the car's own, as the detector finds them.
    fn step_unaided(&mut self, input: TickInput) -> CornerSpeedsFrame {
        let here = SpeedPoint {
            speed: input.speed,
            lap_pct: input.lap_pct,
        };

        if input.speed < STOPPED_MPS {
            self.detector.abandon();
        }

        if let Some(corner) = self.detector.feed(here, input.track) {
            self.detected = Some(corner);
        }

        if let Some(active) = self.detector.active {
            return CornerSpeedsFrame {
                current: Some(active.pass()),
                target: None,
            };
        }

        CornerSpeedsFrame {
            current: self.detected.map(|corner| CornerPass {
                entry: corner.speeds.entry,
                apex: corner.speeds.apex,
                apex_passed: true,
                exit: Some(corner.speeds.exit),
            }),
            target: None,
        }
    }

    fn abandon(&mut self) {
        self.detector.abandon();
        self.detected = None;
        self.tracked = None;
        self.finished = None;
    }
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

        let is_off_track =
            ctx.car_status.is_on_track == Some(false) || ctx.car_status.on_pit_road == Some(true);

        if is_off_track {
            self.abandon();

            return Some(ComputedOutput::CornerSpeeds(CornerSpeedsFrame::default()));
        }

        let frame = self.step(TickInput {
            speed: ctx.car_dynamics.speed,
            lap_pct,
            track: Track {
                length_m: ctx.track_length_m,
            },
        });

        Some(ComputedOutput::CornerSpeeds(frame))
    }

    fn reset(&mut self) {
        let reference = self.reference.take();

        *self = Self::default();
        self.reference = reference;
    }

    fn command(&mut self, command: &ProcessorCommand) {
        if let ProcessorCommand::ActiveReference(reference) = command {
            self.reference = reference.clone();
            self.targets = None;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::reference_lap::{ReferenceLapSample, TrackCondition};

    const TRACK: Track = Track { length_m: 1000.0 };
    const POINTS_PER_LAP: u32 = 1000;

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

    /// A lap of straights at 60 m/s with one corner: down to `apex` at 30 %
    /// of the lap, back up by 45 %.
    fn lap_speeds(apex: f32) -> Vec<f32> {
        (0..POINTS_PER_LAP)
            .map(|index| {
                let pct = index as f32 / POINTS_PER_LAP as f32;

                if (0.2..0.3).contains(&pct) {
                    60.0 - (60.0 - apex) * (pct - 0.2) / 0.1
                } else if (0.3..0.45).contains(&pct) {
                    apex + (60.0 - apex) * (pct - 0.3) / 0.15
                } else {
                    60.0
                }
            })
            .collect()
    }

    fn reference(apex: f32) -> Arc<ReferenceLapData> {
        Arc::new(ReferenceLapData {
            track_id: 1,
            car_screen_name: String::new(),
            lap_time: 60.0,
            samples: lap_speeds(apex).into_iter().map(sample).collect(),
            condition: TrackCondition::default(),
            recorded_wetness: None,
            recorded_tire_wear: None,
            recorded_fuel_level: None,
        })
    }

    /// Drives one lap of `speeds`, a thousandth of the lap a point, returning
    /// the frame at every point.
    fn drive(processor: &mut CornerSpeedsProcessor, speeds: &[f32]) -> Vec<CornerSpeedsFrame> {
        speeds
            .iter()
            .enumerate()
            .map(|(index, speed)| {
                processor.step(TickInput {
                    speed: *speed,
                    lap_pct: index as f32 / POINTS_PER_LAP as f32,
                    track: TRACK,
                })
            })
            .collect()
    }

    #[test]
    fn the_reference_corner_is_found_from_its_speeds() {
        let corners = reference_corners(&reference(30.0), TRACK);

        assert_eq!(corners.len(), 1);

        let corner = corners[0];

        assert_eq!(corner.speeds.entry, 60.0);
        assert!((corner.speeds.apex - 30.0).abs() < 0.5);
        assert!((corner.apex_pct - 0.3).abs() < 0.005);
        // 100 m past the apex, two thirds of a metre a metre back up.
        assert!((corner.speeds.exit - 50.0).abs() < 1.0);
    }

    #[test]
    fn a_pass_reads_its_entry_apex_and_exit() {
        let mut processor = CornerSpeedsProcessor::default();
        let frames = drive(&mut processor, &lap_speeds(25.0));
        let pass = frames[460].current.expect("the corner just left");

        assert_eq!(pass.entry, 60.0);
        assert!((pass.apex - 25.0).abs() < 0.5);
        assert!(pass.apex_passed);
        assert!(pass.exit.is_some());
    }

    #[test]
    fn the_apex_stays_open_until_the_speed_climbs_again() {
        let mut processor = CornerSpeedsProcessor::default();
        let frames = drive(&mut processor, &lap_speeds(25.0));

        assert!(!frames[300].current.unwrap().apex_passed);
        assert!(frames[320].current.unwrap().apex_passed);
        assert_eq!(frames[320].current.unwrap().exit, None);
    }

    #[test]
    fn the_targets_show_on_the_approach_and_stay_through_the_corner() {
        let mut processor = CornerSpeedsProcessor::default();

        processor.command(&ProcessorCommand::ActiveReference(Some(reference(30.0))));

        let frames = drive(&mut processor, &lap_speeds(28.0));

        let approach = &frames[180];

        assert_eq!(approach.current, None);
        assert_eq!(approach.target.unwrap().entry, 60.0);

        let braking = &frames[250];

        assert!(braking.current.is_some());
        assert!((braking.target.unwrap().apex - 30.0).abs() < 0.5);
    }

    #[test]
    fn a_stop_on_a_straight_is_not_a_corner() {
        let mut processor = CornerSpeedsProcessor::default();

        processor.command(&ProcessorCommand::ActiveReference(Some(reference(30.0))));

        let mut speeds = vec![60.0; POINTS_PER_LAP as usize];

        for (index, speed) in speeds.iter_mut().enumerate().take(800).skip(600) {
            *speed = (60.0 - (index - 600) as f32).max(0.0);
        }

        let frames = drive(&mut processor, &speeds);

        // Still the corner left at 30 %: the stop never became one of its own.
        assert!(frames[600..800]
            .iter()
            .all(|frame| frame.current.is_none_or(|pass| pass.apex > 20.0)));
    }

    #[test]
    fn without_a_reference_a_stop_breaks_off_the_corner() {
        let mut processor = CornerSpeedsProcessor::default();
        let mut speeds = vec![60.0; 400];

        speeds.extend((0..60).map(|step| 60.0 - step as f32));
        speeds.extend(vec![0.0; 100]);
        speeds.extend((0..60).map(|step| step as f32));

        let frames = drive(&mut processor, &speeds);

        assert_eq!(frames.last().unwrap().current, None);
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
                        lap_pct: index as f32 / POINTS_PER_LAP as f32,
                    },
                    TRACK,
                )
            })
            .collect();

        assert_eq!(corners.len(), 1);
        assert_eq!(corners[0].speeds.exit, 36.0);

        let second = detector.active.expect("the second corner");

        assert_eq!(second.entry.speed, 36.0);
    }
}
