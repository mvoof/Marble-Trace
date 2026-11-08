use std::collections::{HashMap, VecDeque};

use crate::field::driver_entries::DriverEntry;
use mt_model::sim::enums::TrackSurface;

/// How many measured stops each loss is the median of. Recent enough to
/// follow a change of pit speed limit between sessions, wide enough that one
/// car stalling on the way out does not move it.
const LOSS_SAMPLES: usize = 8;

/// A pit lane longer than this share of the lap is a teleport or a replay jump,
/// not a lane anyone drove.
const MAX_LANE_SPAN: f64 = 0.5;

/// One car's visit to pit road, from the first tick on it.
struct OpenStop {
    entered_at: f64,
    entry_pct: f32,
    lap: i32,
    /// Seconds spent in the stall so far, closed spells only.
    stall_s: f64,
    /// When the current spell in the stall began; `None` while moving.
    stall_since: Option<f64>,
    /// Where the car stood and when it last drove away from there: the start
    /// of the stretch the exit loss is measured over.
    stall_pct: Option<f32>,
    left_stall_at: Option<f64>,
    /// The car was seen driving onto pit road from the track. A stop the
    /// window opened onto, a tow into the stall or a reset to the pits has no
    /// entry to time from, and its lane time would be wrong.
    drove_in: bool,
}

impl OpenStop {
    fn stall_total(&self, now: f64) -> f64 {
        self.stall_s + self.stall_since.map_or(0.0, |since| now - since)
    }
}

/// The last tick's view of a car, to tell driving in from appearing there.
#[derive(Clone, Copy)]
struct Previous {
    on_pit_road: bool,
    track_surface: TrackSurface,
}

/// Every car's time on pit road, and from those what the lane itself costs.
///
/// Per car it fills `pit_lap`, `pit_elapsed_s` and `last_pit_s` on the entry.
/// From every stop it saw from the entry line to the exit line it measures the
/// lane loss: time on pit road, less time standing in the stall, less what the
/// same stretch of track takes at the car's racing pace. The sim reports no
/// such figure, and measuring it from the whole field means the first stop of
/// a race already has one — whoever stopped before us paid it too.
///
/// In the same way it measures the exit loss, from the stall to the exit line:
/// the part of the lane still ahead of a car standing in its box, whose gaps
/// to the field already carry the entry it drove.
///
/// The braking before the entry line and the run up to speed after the exit
/// are outside pit road and not counted, so the figure is a little short of the
/// whole cost of a stop.
#[derive(Default)]
pub struct PitTimingTracker {
    open: HashMap<i32, OpenStop>,
    /// Lap and pit road time of each car's last completed stop.
    last: HashMap<i32, (i32, f64)>,
    previous: HashMap<i32, Previous>,
    lane_losses: LossSamples,
    exit_losses: LossSamples,
    session_num: Option<i32>,
}

/// What the pit lane costs, measured from the field's stops. Each is `None`
/// until a stop has been timed over its stretch.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct PitLaneLoss {
    /// Entry line to exit line, the time standing in the stall left out.
    pub lane_s: Option<f32>,
    /// Stall to exit line.
    pub exit_s: Option<f32>,
}

impl PitTimingTracker {
    /// Fills the per-car pit fields and returns what the lane costs.
    pub fn apply(
        &mut self,
        entries: &mut [DriverEntry],
        session_time: Option<f64>,
        session_num: Option<i32>,
    ) -> PitLaneLoss {
        if session_num != self.session_num {
            // The stops belong to a session; the lane belongs to the track, so
            // the loss measured in practice still holds in the race.
            self.open.clear();
            self.last.clear();
            self.previous.clear();
            self.session_num = session_num;
        }

        if let Some(now) = session_time {
            for entry in entries.iter_mut() {
                self.track(entry, now);
            }
        }

        PitLaneLoss {
            lane_s: self.lane_losses.median(),
            exit_s: self.exit_losses.median(),
        }
    }

    pub fn reset(&mut self) {
        *self = Self::default();
    }

    fn track(&mut self, entry: &mut DriverEntry, now: f64) {
        let car = entry.car_idx;
        let previous = self.previous.insert(
            car,
            Previous {
                on_pit_road: entry.on_pit_road,
                track_surface: entry.track_surface,
            },
        );

        if entry.on_pit_road {
            let stop = self.open.entry(car).or_insert_with(|| OpenStop {
                entered_at: now,
                entry_pct: entry.lap_dist_pct,
                lap: entry.lap,
                stall_s: 0.0,
                stall_since: None,
                stall_pct: None,
                left_stall_at: None,
                drove_in: drove_onto_pit_road(previous, entry.track_surface),
            });

            let in_stall = entry.track_surface == TrackSurface::InPitStall;

            match (in_stall, stop.stall_since) {
                (true, None) => {
                    stop.stall_since = Some(now);
                    stop.stall_pct = Some(entry.lap_dist_pct);
                }
                (false, Some(since)) => {
                    stop.stall_s += now - since;
                    stop.stall_since = None;
                    stop.left_stall_at = Some(now);
                }
                _ => {}
            }

            entry.pit_lap = Some(stop.lap);
            entry.pit_elapsed_s = Some((now - stop.entered_at) as f32);
        } else if let Some(stop) = self.open.remove(&car) {
            let total = now - stop.entered_at;

            self.last.insert(car, (stop.lap, total));

            // A car that left pit road by leaving the world quit or reset; it
            // did not drive out of the lane.
            if entry.track_surface != TrackSurface::NotInWorld {
                self.measure(&stop, entry, total, now);
            }
        }

        if let Some(&(lap, total)) = self.last.get(&car) {
            entry.pit_lap = entry.pit_lap.or(Some(lap));
            entry.last_pit_s = Some(total as f32);
        }
    }

    fn measure(&mut self, stop: &OpenStop, exit: &DriverEntry, total: f64, now: f64) {
        let Some(racing_lap_s) = racing_lap_time(exit) else {
            return;
        };

        if stop.drove_in {
            let driving = total - stop.stall_total(now);

            if let Some(loss) =
                stretch_loss(stop.entry_pct, exit.lap_dist_pct, driving, racing_lap_s)
            {
                self.lane_losses.push(loss);
            }
        }

        if let (Some(stall_pct), Some(left_at)) = (stop.stall_pct, stop.left_stall_at) {
            if let Some(loss) =
                stretch_loss(stall_pct, exit.lap_dist_pct, now - left_at, racing_lap_s)
            {
                self.exit_losses.push(loss);
            }
        }
    }
}

/// The last few measured losses of one kind, read as their median.
#[derive(Default)]
struct LossSamples {
    samples: VecDeque<f64>,
}

impl LossSamples {
    fn push(&mut self, loss: f64) {
        if self.samples.len() == LOSS_SAMPLES {
            self.samples.pop_front();
        }

        self.samples.push_back(loss);
    }

    fn median(&self) -> Option<f32> {
        if self.samples.is_empty() {
            return None;
        }

        let mut sorted: Vec<f64> = self.samples.iter().copied().collect();
        sorted.sort_by(f64::total_cmp);

        let middle = sorted.len() / 2;
        let median = if sorted.len().is_multiple_of(2) {
            (sorted[middle - 1] + sorted[middle]) / 2.0
        } else {
            sorted[middle]
        };

        Some(median as f32)
    }
}

/// What driving a stretch of pit road cost over covering it at racing pace;
/// `None` when the numbers cannot be a lane anyone drove.
fn stretch_loss(from_pct: f32, to_pct: f32, driving_s: f64, racing_lap_s: f64) -> Option<f64> {
    let span = wrapped_span(from_pct, to_pct);

    if span <= 0.0 || span > MAX_LANE_SPAN {
        return None;
    }

    let loss = driving_s - span * racing_lap_s;

    (loss.is_finite() && loss > 0.0 && loss < racing_lap_s).then_some(loss)
}

/// The car came onto pit road under its own power: off it a tick ago, in the
/// world, and not dropped straight into the stall.
fn drove_onto_pit_road(previous: Option<Previous>, surface: TrackSurface) -> bool {
    previous.is_some_and(|previous| {
        !previous.on_pit_road && previous.track_surface != TrackSurface::NotInWorld
    }) && surface != TrackSurface::InPitStall
}

/// The pace the car would have covered the lane's stretch of track at.
fn racing_lap_time(entry: &DriverEntry) -> Option<f64> {
    entry
        .best_lap_time
        .or(entry.last_lap_time)
        .or(Some(entry.class_est_lap_time))
        .filter(|seconds| *seconds > 0.0)
        .map(f64::from)
}

/// Share of the lap from entry to exit, across the start/finish line too.
fn wrapped_span(from: f32, to: f32) -> f64 {
    let span = f64::from(to) - f64::from(from);

    if span < 0.0 {
        span + 1.0
    } else {
        span
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::field::driver_entries::tests::make_live_entry;

    const LAP_S: f32 = 100.0;
    const SESSION: Option<i32> = Some(1);

    /// Lap distance is an f32, so a share of the lap carries its rounding.
    fn assert_close(actual: Option<f32>, expected: f32) {
        let actual = actual.expect("a value");

        assert!(
            (actual - expected).abs() < 1e-3,
            "got {actual}, want {expected}"
        );
    }

    fn car(on_pit_road: bool, pct: f32, surface: TrackSurface) -> DriverEntry {
        let mut entry = make_live_entry(3, 1, 7, pct, surface);
        entry.on_pit_road = on_pit_road;
        entry.best_lap_time = Some(LAP_S);

        entry
    }

    fn tick(
        tracker: &mut PitTimingTracker,
        entry: DriverEntry,
        now: f64,
    ) -> (DriverEntry, PitLaneLoss) {
        let mut entries = [entry];
        let loss = tracker.apply(&mut entries, Some(now), SESSION);
        let [entry] = entries;

        (entry, loss)
    }

    /// Track at 0.90, pit road from 0.95 to 0.05 across the line: 10 % of a
    /// 100 s lap is 10 s at racing pace. 40 s on pit road, 15 of them in the stall.
    fn full_stop(tracker: &mut PitTimingTracker) -> (DriverEntry, PitLaneLoss) {
        tick(tracker, car(false, 0.90, TrackSurface::AproachingPits), 0.0);
        tick(tracker, car(true, 0.95, TrackSurface::AproachingPits), 1.0);
        tick(tracker, car(true, 0.99, TrackSurface::InPitStall), 10.0);
        tick(tracker, car(true, 0.99, TrackSurface::AproachingPits), 25.0);

        tick(tracker, car(false, 0.05, TrackSurface::OnTrack), 41.0)
    }

    #[test]
    fn measures_the_lane_from_a_stop_driven_in_and_out() {
        let mut tracker = PitTimingTracker::default();
        let (entry, loss) = full_stop(&mut tracker);

        // 40 s on pit road − 15 s standing − 10 s at racing pace.
        assert_close(loss.lane_s, 15.0);
        assert_close(entry.last_pit_s, 40.0);
        // 16 s from the stall at 0.99 to the exit at 0.05 − 6 s at racing pace.
        assert_close(loss.exit_s, 10.0);
        assert_eq!(entry.pit_lap, Some(7));
        assert_eq!(entry.pit_elapsed_s, None);
    }

    #[test]
    fn runs_the_clock_while_on_pit_road() {
        let mut tracker = PitTimingTracker::default();
        tick(
            &mut tracker,
            car(false, 0.90, TrackSurface::AproachingPits),
            0.0,
        );
        tick(
            &mut tracker,
            car(true, 0.95, TrackSurface::AproachingPits),
            1.0,
        );

        let (entry, loss) = tick(
            &mut tracker,
            car(true, 0.99, TrackSurface::InPitStall),
            13.5,
        );

        assert_eq!(entry.pit_elapsed_s, Some(12.5));
        assert_eq!(entry.pit_lap, Some(7));
        assert_eq!(loss.lane_s, None);
    }

    #[test]
    fn a_stop_the_window_opened_onto_is_timed_but_not_measured() {
        let mut tracker = PitTimingTracker::default();
        tick(&mut tracker, car(true, 0.99, TrackSurface::InPitStall), 0.0);

        let (entry, loss) = tick(&mut tracker, car(false, 0.05, TrackSurface::OnTrack), 20.0);

        assert_close(entry.last_pit_s, 20.0);
        assert_eq!(loss.lane_s, None);
        // It never left the stall on pit road, so nothing marks the exit run either.
        assert_eq!(loss.exit_s, None);
    }

    #[test]
    fn a_tow_into_the_stall_still_measures_the_exit() {
        let mut tracker = PitTimingTracker::default();
        tick(
            &mut tracker,
            car(false, -1.0, TrackSurface::NotInWorld),
            0.0,
        );
        tick(&mut tracker, car(true, 0.99, TrackSurface::InPitStall), 1.0);
        tick(
            &mut tracker,
            car(true, 0.99, TrackSurface::AproachingPits),
            30.0,
        );

        let (_, loss) = tick(&mut tracker, car(false, 0.05, TrackSurface::OnTrack), 46.0);

        assert_eq!(loss.lane_s, None);
        assert_close(loss.exit_s, 10.0);
    }

    #[test]
    fn a_tow_into_the_stall_is_not_measured() {
        let mut tracker = PitTimingTracker::default();
        tick(
            &mut tracker,
            car(false, -1.0, TrackSurface::NotInWorld),
            0.0,
        );
        tick(&mut tracker, car(true, 0.99, TrackSurface::InPitStall), 1.0);

        let (_, loss) = tick(&mut tracker, car(false, 0.05, TrackSurface::OnTrack), 30.0);

        assert_eq!(loss.lane_s, None);
    }

    #[test]
    fn a_reset_straight_into_the_stall_is_not_measured() {
        let mut tracker = PitTimingTracker::default();
        tick(&mut tracker, car(false, 0.40, TrackSurface::OnTrack), 0.0);
        tick(&mut tracker, car(true, 0.99, TrackSurface::InPitStall), 0.1);

        let (_, loss) = tick(&mut tracker, car(false, 0.05, TrackSurface::OnTrack), 30.0);

        assert_eq!(loss.lane_s, None);
    }

    #[test]
    fn leaving_the_world_from_pit_road_is_not_measured() {
        let mut tracker = PitTimingTracker::default();
        tick(
            &mut tracker,
            car(false, 0.90, TrackSurface::AproachingPits),
            0.0,
        );
        tick(
            &mut tracker,
            car(true, 0.95, TrackSurface::AproachingPits),
            1.0,
        );

        let (_, loss) = tick(
            &mut tracker,
            car(false, -1.0, TrackSurface::NotInWorld),
            10.0,
        );

        assert_eq!(loss.lane_s, None);
    }

    #[test]
    fn a_drive_through_is_all_lane() {
        let mut tracker = PitTimingTracker::default();
        tick(
            &mut tracker,
            car(false, 0.90, TrackSurface::AproachingPits),
            0.0,
        );
        tick(
            &mut tracker,
            car(true, 0.95, TrackSurface::AproachingPits),
            1.0,
        );

        let (_, loss) = tick(&mut tracker, car(false, 0.05, TrackSurface::OnTrack), 26.0);

        // 25 s on pit road − 10 s at racing pace.
        assert_close(loss.lane_s, 15.0);
    }

    #[test]
    fn the_loss_is_the_median_of_the_stops_measured() {
        let mut tracker = PitTimingTracker::default();
        let exits = [26.0, 30.0, 60.0];
        let mut loss = PitLaneLoss::default();

        for (stop, exit) in exits.iter().enumerate() {
            let start = stop as f64 * 1000.0;
            tick(
                &mut tracker,
                car(false, 0.90, TrackSurface::AproachingPits),
                start,
            );
            tick(
                &mut tracker,
                car(true, 0.95, TrackSurface::AproachingPits),
                start + 1.0,
            );
            loss = tick(
                &mut tracker,
                car(false, 0.05, TrackSurface::OnTrack),
                start + exit,
            )
            .1;
        }

        // 15, 19 and 49 s: the slow one does not drag it.
        assert_close(loss.lane_s, 19.0);
    }

    #[test]
    fn a_new_session_forgets_the_stops_but_keeps_the_lane() {
        let mut tracker = PitTimingTracker::default();
        full_stop(&mut tracker);

        let mut entries = [car(false, 0.30, TrackSurface::OnTrack)];
        let loss = tracker.apply(&mut entries, Some(5.0), Some(2));

        assert_eq!(entries[0].last_pit_s, None);
        assert_eq!(entries[0].pit_lap, None);
        assert_close(loss.lane_s, 15.0);
    }

    #[test]
    fn no_session_clock_times_nothing() {
        let mut tracker = PitTimingTracker::default();
        let mut entries = [car(true, 0.95, TrackSurface::AproachingPits)];

        tracker.apply(&mut entries, None, SESSION);

        assert_eq!(entries[0].pit_elapsed_s, None);
    }
}
