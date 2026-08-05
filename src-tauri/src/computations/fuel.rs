use std::time::Instant;

use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::capabilities::Capabilities;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use crate::model::player::{CarStatusFrame, LapTimingFrame};
use crate::model::session::SessionSnapshot;

const MAX_LAP_FUEL_HISTORY: usize = 100;
const MIN_RECORDED_FUEL_USE: f32 = 0.1;
const MAX_REALISTIC_LAP_FUEL: f32 = 20.0;

/// A lap counter that advances sooner than this did not come from driving one —
/// a tow, a reset or a session jump moved it.
const MIN_LAP_SECS: f64 = 10.0;
/// Smallest rise in tank level counted as refuelling rather than sensor jitter.
const MIN_REFUEL_STEP: f32 = 0.05;
/// Laps of context the outlier test judges a new lap against.
const OUTLIER_SAMPLE_LAPS: usize = 10;
/// Below this the spread is not yet meaningful and every lap is taken.
const OUTLIER_MIN_HISTORY: usize = 3;
/// 1.5 is the textbook whisker; racing consumption is noisier, so widen it.
const OUTLIER_IQR_FACTOR: f32 = 2.0;
/// Laps this close to the mean are kept whatever the spread says — in a very
/// consistent stint the IQR collapses and would start rejecting good laps.
const OUTLIER_MEAN_TOLERANCE: f32 = 0.15;

/// Laps of margin kept between the close of the pit window and a dry tank —
/// the same one-lap cushion `fuel_to_add_with_buffer` adds to the refuel
/// figure, so the two agree on what "with a lap in hand" means.
const PIT_WINDOW_END_BUFFER_LAPS: f32 = 1.0;

pub const DEFAULT_PIT_WARNING_LAPS: f32 = 3.0;
/// Averaging window in laps. 0 = every recorded lap of the session.
pub const DEFAULT_FUEL_AVG_WINDOW: usize = 0;

/// User-tunable fuel parameters, snapshotted once per tick.
#[derive(Debug, Clone, Copy)]
pub struct FuelSettings {
    pub pit_warning_laps: f32,
    pub avg_window: usize,
}

impl Default for FuelSettings {
    fn default() -> Self {
        Self {
            pit_warning_laps: DEFAULT_PIT_WARNING_LAPS,
            avg_window: DEFAULT_FUEL_AVG_WINDOW,
        }
    }
}

/// One tick of everything the lap bookkeeping needs to judge a lap.
#[derive(Debug, Clone, Copy)]
pub struct FuelSample {
    pub lap: i32,
    pub fuel_level: f32,
    pub session_num: i32,
    /// False while towed, in the garage, or otherwise not on track.
    pub on_track: bool,
    /// A full-course caution is out — the lap is not run at racing pace.
    pub caution: bool,
}

/// One completed lap as measured, kept whether or not it counts.
///
/// A rejected lap still burned fuel and still happened, so it belongs in the
/// history the widget draws — dropping it silently left the chart unable to say
/// which lap any bar referred to. `rejected` carries why it does not count.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct FuelLapRecord {
    pub lap: i32,
    pub used: f32,
    /// `None` for a lap that counts towards the average.
    pub rejected: Option<String>,
}

impl FuelLapRecord {
    fn counts(&self) -> bool {
        self.rejected.is_none()
    }
}

pub struct FuelState {
    pub lap_fuel_history: Vec<FuelLapRecord>,
    pub last_lap: i32,
    pub last_lap_start_fuel: Option<f32>,
    pub tracked_session_num: i32,
    /// Fuel taken on since the lap began, so a stop does not lose the lap.
    refuelled_this_lap: f32,
    prev_fuel_level: Option<f32>,
    lap_left_track: bool,
    lap_under_caution: bool,
    lap_started_at: Option<Instant>,
}

impl Default for FuelState {
    fn default() -> Self {
        Self {
            lap_fuel_history: Vec::new(),
            last_lap: -1,
            last_lap_start_fuel: None,
            tracked_session_num: -1,
            refuelled_this_lap: 0.0,
            prev_fuel_level: None,
            lap_left_track: false,
            lap_under_caution: false,
            lap_started_at: None,
        }
    }
}

/// Whether a lap's consumption is too far from recent laps to be believable.
///
/// An interquartile fence rather than a distance from the mean: one wild lap
/// drags a mean far enough to start rejecting the good laps after it.
fn is_outlier(used: f32, history: &[f32]) -> bool {
    let sample_start = history.len().saturating_sub(OUTLIER_SAMPLE_LAPS);
    let mut sample: Vec<f32> = history[sample_start..].to_vec();

    if sample.len() < OUTLIER_MIN_HISTORY {
        return false;
    }

    sample.sort_by(f32::total_cmp);

    let quartile = |fraction: f32| sample[((sample.len() as f32) * fraction) as usize];
    let (q1, q3) = (quartile(0.25), quartile(0.75));
    let fence = OUTLIER_IQR_FACTOR * (q3 - q1);
    let within_fence = used >= q1 - fence && used <= q3 + fence;

    let mean = sample.iter().sum::<f32>() / sample.len() as f32;
    let within_tolerance = (used - mean).abs() <= mean * OUTLIER_MEAN_TOLERANCE;

    !(within_fence || within_tolerance)
}

impl FuelState {
    pub fn reset(&mut self) {
        *self = Self::default();
    }

    pub fn update(&mut self, sample: FuelSample) {
        if sample.session_num != self.tracked_session_num {
            self.reset();
            self.tracked_session_num = sample.session_num;
        }

        self.track_refuel(sample.fuel_level);

        if !sample.on_track {
            self.lap_left_track = true;
        }

        if sample.caution {
            self.lap_under_caution = true;
        }

        if self.last_lap < 0 || sample.lap < self.last_lap {
            if sample.lap < self.last_lap && self.last_lap >= 0 {
                self.lap_fuel_history.clear();
            }

            self.begin_lap(sample.lap, sample.fuel_level);

            return;
        }

        if sample.lap != self.last_lap {
            self.finish_lap(sample.fuel_level);
            self.begin_lap(sample.lap, sample.fuel_level);
        }
    }

    /// A rising tank means fuel went in. Counting it keeps the lap a stop was
    /// taken on: without it the lap reads as negative use and is thrown away,
    /// which costs the history exactly the laps a long stint depends on.
    fn track_refuel(&mut self, fuel_level: f32) {
        if let Some(prev) = self.prev_fuel_level {
            let added = fuel_level - prev;

            if added > MIN_REFUEL_STEP {
                self.refuelled_this_lap += added;
            }
        }

        self.prev_fuel_level = Some(fuel_level);
    }

    fn begin_lap(&mut self, lap: i32, fuel_level: f32) {
        self.last_lap = lap;
        self.last_lap_start_fuel = Some(fuel_level);
        self.refuelled_this_lap = 0.0;
        self.lap_left_track = false;
        self.lap_under_caution = false;
        self.lap_started_at = Some(Instant::now());
    }

    fn finish_lap(&mut self, fuel_level: f32) {
        let Some(start_fuel) = self.last_lap_start_fuel else {
            return;
        };

        let used = start_fuel + self.refuelled_this_lap - fuel_level;
        let lap_secs = self.lap_started_at.map(|at| at.elapsed().as_secs_f64());
        // Judged against the laps that count, before this one joins them.
        let rejected = self.rejection_reason(used, lap_secs);

        // Every completed lap, kept or dropped, with the readings it was
        // measured between — the only way to tell a wrong per-lap figure apart
        // from a wrong average downstream.
        debug!(
            lap = self.last_lap,
            start_fuel,
            end_fuel = fuel_level,
            refuelled = self.refuelled_this_lap,
            used,
            rejected = rejected.unwrap_or("no"),
            "fuel lap"
        );

        self.lap_fuel_history.push(FuelLapRecord {
            lap: self.last_lap,
            used,
            rejected: rejected.map(str::to_owned),
        });

        if self.lap_fuel_history.len() > MAX_LAP_FUEL_HISTORY {
            self.lap_fuel_history.remove(0);
        }
    }

    /// Consumption of the laps that count, in order. Everything the average,
    /// the outlier fence and the widget's statistics are built from.
    pub fn counted_laps(&self) -> Vec<f32> {
        self.lap_fuel_history
            .iter()
            .filter(|record| record.counts())
            .map(|record| record.used)
            .collect()
    }

    /// Why a completed lap does not belong in the consumption history, if it
    /// does not. Only laps driven flat out under green describe race pace;
    /// everything else drags the average somewhere the strategy cannot follow.
    fn rejection_reason(&self, used: f32, lap_secs: Option<f64>) -> Option<&'static str> {
        if self.last_lap <= 0 {
            return Some("out-lap");
        }

        if lap_secs.is_some_and(|secs| secs < MIN_LAP_SECS) {
            return Some("too-short");
        }

        if used <= MIN_RECORDED_FUEL_USE || used >= MAX_REALISTIC_LAP_FUEL {
            return Some("implausible");
        }

        if self.lap_left_track {
            return Some("left-track");
        }

        if self.lap_under_caution {
            return Some("caution");
        }

        if is_outlier(used, &self.counted_laps()) {
            return Some("outlier");
        }

        None
    }

    /// Mean fuel use over the last `window` laps; `window == 0` averages the
    /// whole recorded history.
    pub fn avg(&self, window: usize) -> Option<f32> {
        let counted = self.counted_laps();

        if counted.is_empty() {
            return None;
        }

        let take = if window == 0 {
            counted.len()
        } else {
            window.min(counted.len())
        };

        let sum: f32 = counted.iter().rev().take(take).sum();

        Some(sum / take as f32)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct FuelComputedFrame {
    pub avg_per_lap: Option<f32>,
    pub laps_remaining: Option<f32>,
    pub laps_to_finish: Option<f32>,
    /// Positive = surplus liters, negative = deficit
    pub shortage: Option<f32>,
    pub fuel_to_add: Option<f32>,
    pub fuel_to_add_with_buffer: Option<f32>,
    pub fuel_save_per_lap: Option<f32>,
    pub pit_warning: bool,
    pub pit_window_start: Option<i32>,
    pub pit_window_end: Option<i32>,
    pub is_timed_race: bool,
    pub lap_fuel_history: Vec<FuelLapRecord>,
}

pub fn compute(
    car_status: &CarStatusFrame,
    lap_timing: &LapTimingFrame,
    session: &SessionSnapshot,
    session_num: Option<i32>,
    session_time_remain: Option<f64>,
    fuel_settings: FuelSettings,
    fuel_state: &FuelState,
) -> FuelComputedFrame {
    let fuel_level = car_status.fuel_level;
    let pit_warning_laps = fuel_settings.pit_warning_laps;

    let avg_per_lap = fuel_state.avg(fuel_settings.avg_window);

    let laps_remaining = avg_per_lap.and_then(|avg| {
        if avg > 0.0 {
            Some(fuel_level / avg)
        } else {
            None
        }
    });

    let current_session_num = session_num.unwrap_or(session.current_session_num);

    let sessions = &session.sessions;
    let current_session = if current_session_num >= 0 {
        sessions.get(current_session_num as usize)
    } else {
        None
    };

    let session_laps = current_session
        .map(|s| s.session_laps.as_str())
        .unwrap_or("unlimited");

    let is_timed_race = session_laps.eq_ignore_ascii_case("unlimited");

    let laps_to_finish: Option<f32> = if !is_timed_race {
        session_laps.parse::<f32>().ok().map(|total| {
            let current_lap = lap_timing.lap.unwrap_or(0) as f32;
            let lap_dist_pct = lap_timing.lap_dist_pct.unwrap_or(0.0);
            total - current_lap - lap_dist_pct
        })
    } else {
        let best_lap = lap_timing.lap_best_lap_time.filter(|&t| t > 0.0);
        let last_lap = lap_timing.lap_last_lap_time.filter(|&t| t > 0.0);

        best_lap.or(last_lap).and_then(|lap_time_sec| {
            session_time_remain
                .filter(|&t| t > 0.0)
                .map(|remain| remain as f32 / lap_time_sec)
        })
    };

    let fuel_needed = match (laps_to_finish, avg_per_lap) {
        (Some(ltf), Some(avg)) if avg > 0.0 => Some(ltf * avg),
        _ => None,
    };

    let shortage = fuel_needed.map(|needed| fuel_level - needed);
    let fuel_to_add = fuel_needed.map(|needed| (needed - fuel_level).max(0.0));
    let fuel_to_add_with_buffer = match (laps_to_finish, avg_per_lap) {
        (Some(ltf), Some(avg)) if avg > 0.0 => Some(((ltf + 1.0) * avg - fuel_level).max(0.0)),
        _ => None,
    };

    let current_lap_i = lap_timing.lap.unwrap_or(0);

    // `laps_remaining` counts from where the car is right now, not from the
    // start/finish line, so the lap counter alone is not a position to add it
    // to — the distance already covered on this lap has to come with it.
    // Without it both edges sit up to a full lap early, and the window creeps
    // as the lap runs on.
    let lap_position = current_lap_i as f32 + lap_timing.lap_dist_pct.unwrap_or(0.0);

    let (pit_window_start, pit_window_end) = match (laps_remaining, avg_per_lap) {
        (Some(rem), Some(avg)) if avg > 0.0 => {
            let empty_at = lap_position + rem;
            let start = (empty_at - pit_warning_laps).floor() as i32;
            // A one-lap cushion: the window shuts before the lap the tank runs
            // out on, never on it.
            let end = (empty_at - PIT_WINDOW_END_BUFFER_LAPS).floor() as i32;

            (Some(start), Some(end.max(start)))
        }
        _ => (None, None),
    };

    let pit_warning = match (shortage, avg_per_lap) {
        (Some(s), Some(avg)) if avg > 0.0 => s < 0.0 || s < pit_warning_laps * avg,
        _ => false,
    };

    let fuel_save_per_lap = match (shortage, laps_to_finish) {
        (Some(s), Some(ltf)) if s < 0.0 && ltf > 0.0 => Some(s.abs() / ltf),
        _ => None,
    };

    FuelComputedFrame {
        avg_per_lap,
        laps_remaining,
        laps_to_finish,
        shortage,
        fuel_to_add,
        fuel_to_add_with_buffer,
        fuel_save_per_lap,
        pit_warning,
        pit_window_start,
        pit_window_end,
        is_timed_race,
        lap_fuel_history: fuel_state.lap_fuel_history.clone(),
    }
}

/// Stateful processor wrapping the fuel computation.
#[derive(Default)]
pub struct FuelProcessor {
    pub state: FuelState,
}

impl Processor for FuelProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::Fuel
    }

    fn required(&self) -> Capabilities {
        Capabilities::FUEL
    }

    fn rate(&self) -> TickRate {
        TickRate::Hz4
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        let flags = &ctx.car_status.flags;

        self.state.update(FuelSample {
            lap: ctx.lap_timing.lap.unwrap_or(-1),
            fuel_level: ctx.car_status.fuel_level,
            session_num: ctx.session_num.unwrap_or(-1),
            on_track: ctx.car_status.is_on_track.unwrap_or(true),
            caution: flags.yellow
                || flags.yellow_waving
                || flags.caution
                || flags.caution_waving
                || flags.red,
        });

        let frame = compute(
            ctx.car_status,
            ctx.lap_timing,
            ctx.session,
            ctx.session_num,
            ctx.session_time_remain,
            ctx.fuel_settings,
            &self.state,
        );

        Some(ComputedOutput::Fuel(frame))
    }

    fn reset(&mut self) {
        self.state.reset();
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;
    use crate::model::player::{CarStatusFrame, LapTimingFrame};

    fn make_car_status(fuel_level: f32) -> CarStatusFrame {
        CarStatusFrame {
            fuel_level,
            fuel_level_pct: None,
            fuel_use_per_hour: None,
            oil_temp: None,
            oil_press: None,
            water_temp: None,
            voltage: None,
            on_pit_road: None,
            is_on_track: None,
            car_left_right: None,
            engine_warnings: None,
            player_car_sl_shift_rpm: vec![],
            player_car_sl_blink_rpm: vec![],
            flags: Default::default(),
            dc_abs: None,
            dc_brake_bias: None,
            dc_traction_control: None,
            dc_throttle_shape: None,
        }
    }

    fn make_lap_timing(lap: Option<i32>, lap_dist_pct: Option<f32>) -> LapTimingFrame {
        LapTimingFrame {
            lap,
            lap_dist: None,
            lap_dist_pct,
            lap_current_lap_time: 0.0,
            lap_last_lap_time: None,
            lap_best_lap_time: None,
            player_car_position: None,
            player_car_class_position: None,
            lap_delta_to_session_best_live: None,
            lap_delta_to_session_optimal_live: None,
            lap_delta_to_driver_best_live: None,
            lap_delta_to_best_lap: None,
            lap_delta_to_best_lap_dd: None,
            lap_delta_to_best_lap_ok: None,
            lap_delta_to_optimal_lap: None,
            lap_delta_to_optimal_lap_dd: None,
            lap_delta_to_optimal_lap_ok: None,
            lap_delta_to_session_best_lap: None,
            lap_delta_to_session_best_lap_dd: None,
            lap_delta_to_session_best_lap_ok: None,
            lap_delta_to_session_lastl_lap: None,
            lap_delta_to_session_lastl_lap_dd: None,
            lap_delta_to_session_lastl_lap_ok: None,
            lap_delta_to_session_optimal_lap: None,
            lap_delta_to_session_optimal_lap_dd: None,
            lap_delta_to_session_optimal_lap_ok: None,
        }
    }

    #[test]
    fn test_compute_empty_history() {
        let car_status = make_car_status(50.0);
        let lap_timing = make_lap_timing(None, None);
        let session = SessionSnapshot::default();
        let fuel_state = FuelState::default();

        let result = compute(
            &car_status,
            &lap_timing,
            &session,
            None,
            None,
            FuelSettings::default(),
            &fuel_state,
        );

        assert_eq!(result.avg_per_lap, None);
        assert_eq!(result.laps_remaining, None);
        assert_eq!(result.laps_to_finish, None);
        assert_eq!(result.shortage, None);
        assert_eq!(result.fuel_to_add, None);
        assert_eq!(result.fuel_to_add_with_buffer, None);
        assert_eq!(result.fuel_save_per_lap, None);
        assert!(!result.pit_warning);
        assert_eq!(result.pit_window_start, None);
        assert_eq!(result.pit_window_end, None);
        assert!(result.is_timed_race);
        assert!(result.lap_fuel_history.is_empty());
    }

    #[test]
    fn test_compute_with_history() {
        let car_status = make_car_status(50.0);
        let lap_timing = make_lap_timing(Some(5), None);
        let session = SessionSnapshot::default();
        let fuel_state = FuelState {
            lap_fuel_history: counted_history(&[2.0, 2.0, 2.0]),
            ..Default::default()
        };

        let result = compute(
            &car_status,
            &lap_timing,
            &session,
            None,
            None,
            FuelSettings::default(),
            &fuel_state,
        );

        assert_eq!(result.avg_per_lap, Some(2.0));
        assert_eq!(result.laps_remaining, Some(25.0)); // 50.0 / 2.0
    }

    /// 3.6L at 2.0L/lap = 1.8 laps of fuel left, on lap 17.
    fn compute_window(
        lap_dist_pct: Option<f32>,
        pit_warning_laps: f32,
    ) -> (Option<i32>, Option<i32>) {
        let car_status = make_car_status(3.6);
        let lap_timing = make_lap_timing(Some(17), lap_dist_pct);
        let session = SessionSnapshot::default();
        let fuel_state = FuelState {
            lap_fuel_history: counted_history(&[2.0, 2.0, 2.0]),
            ..Default::default()
        };

        let result = compute(
            &car_status,
            &lap_timing,
            &session,
            None,
            None,
            FuelSettings {
                pit_warning_laps,
                ..Default::default()
            },
            &fuel_state,
        );

        (result.pit_window_start, result.pit_window_end)
    }

    #[test]
    fn test_pit_window_counts_from_the_car_position() {
        // 40% into lap 17 with 1.8 laps of fuel runs the tank dry 20% into
        // lap 19, so the window covers 16 through 18. Reading the lap counter
        // alone would place it a lap early, at 15 through 17.
        assert_eq!(
            compute_window(Some(0.4), DEFAULT_PIT_WARNING_LAPS),
            (Some(16), Some(18))
        );
    }

    #[test]
    fn test_pit_window_falls_back_to_the_lap_line() {
        // No distance reading: the car is treated as sitting on the line it
        // last crossed, which is where the lap counter puts it.
        assert_eq!(
            compute_window(None, DEFAULT_PIT_WARNING_LAPS),
            (Some(15), Some(17))
        );
    }

    #[test]
    fn test_pit_window_never_closes_before_it_opens() {
        // A warning margin under the closing cushion would invert the range:
        // opening on 19, closing on 18.
        assert_eq!(compute_window(Some(0.4), 0.1), (Some(19), Some(19)));
    }

    #[test]
    fn test_avg_window_uses_most_recent_laps() {
        let state = FuelState {
            lap_fuel_history: counted_history(&[4.0, 4.0, 4.0, 2.0, 2.0]),
            ..Default::default()
        };

        // Window 0 averages everything: (4+4+4+2+2) / 5
        assert_eq!(state.avg(0), Some(3.2));

        // A short window only sees the recent, cheaper laps.
        assert_eq!(state.avg(2), Some(2.0));

        // A window longer than the history falls back to the full history.
        assert_eq!(state.avg(50), Some(3.2));
    }

    #[test]
    fn test_avg_window_changes_laps_remaining() {
        let car_status = make_car_status(20.0);
        let lap_timing = make_lap_timing(Some(5), None);
        let session = SessionSnapshot::default();
        let fuel_state = FuelState {
            lap_fuel_history: counted_history(&[4.0, 4.0, 4.0, 2.0, 2.0]),
            ..Default::default()
        };

        let windowed = compute(
            &car_status,
            &lap_timing,
            &session,
            None,
            None,
            FuelSettings {
                avg_window: 2,
                ..Default::default()
            },
            &fuel_state,
        );

        assert_eq!(windowed.avg_per_lap, Some(2.0));
        assert_eq!(windowed.laps_remaining, Some(10.0)); // 20.0 / 2.0
    }

    fn green(lap: i32, fuel_level: f32) -> FuelSample {
        FuelSample {
            lap,
            fuel_level,
            session_num: 1,
            on_track: true,
            caution: false,
        }
    }

    /// Seeds a history of laps that all count, as a stint of green laps leaves.
    fn counted_history(used: &[f32]) -> Vec<FuelLapRecord> {
        used.iter()
            .enumerate()
            .map(|(index, &used)| FuelLapRecord {
                lap: index as i32 + 1,
                used,
                rejected: None,
            })
            .collect()
    }

    /// Why each recorded lap was rejected, in order — `None` where it counted.
    fn rejections(state: &FuelState) -> Vec<Option<&str>> {
        state
            .lap_fuel_history
            .iter()
            .map(|record| record.rejected.as_deref())
            .collect()
    }

    /// Feeds a sample as if a full-length lap had elapsed since the last one.
    /// The state clock only exists to catch counter jumps no lap could have
    /// produced, and a test runs far faster than any lap.
    fn drive(state: &mut FuelState, sample: FuelSample) {
        state.lap_started_at = state
            .lap_started_at
            .map(|at| at - Duration::from_secs_f64(MIN_LAP_SECS * 2.0));

        state.update(sample);
    }

    #[test]
    fn test_fuel_state_updates_ignoring_lap_zero() {
        let mut state = FuelState::default();

        drive(&mut state, green(0, 50.0));
        assert_eq!(state.last_lap, 0);
        assert_eq!(state.last_lap_start_fuel, Some(50.0));
        assert!(state.lap_fuel_history.is_empty());

        // Same lap: the opening reading stands.
        drive(&mut state, green(0, 49.5));
        assert_eq!(state.last_lap_start_fuel, Some(50.0));
        assert!(state.lap_fuel_history.is_empty());

        // Lap 0 completed — the lap out of the garage tells nothing about pace,
        // but it is still recorded so the chart can show it greyed out.
        drive(&mut state, green(1, 48.0));
        assert_eq!(state.last_lap, 1);
        assert_eq!(rejections(&state), vec![Some("out-lap")]);
        assert!(state.counted_laps().is_empty());

        // Lap 1 completed on 2.5L, the first lap worth counting.
        drive(&mut state, green(2, 45.5));
        assert_eq!(state.counted_laps(), vec![2.5]);
        assert_eq!(state.lap_fuel_history[1].lap, 1);
    }

    #[test]
    fn test_refuelled_lap_is_still_recorded() {
        let mut state = FuelState::default();

        drive(&mut state, green(4, 20.0));

        // Burns 2L, takes on 30L in the pits, then trickles to the line.
        drive(&mut state, green(4, 18.0));
        drive(&mut state, green(4, 48.0));
        drive(&mut state, green(4, 47.5));

        drive(&mut state, green(5, 47.5));

        // 20 burned down to 47.5 having gained 30 — the stop is not fuel saved.
        assert_eq!(state.counted_laps(), vec![2.5]);
    }

    #[test]
    fn test_caution_lap_is_dropped() {
        let mut state = FuelState::default();

        drive(&mut state, green(4, 20.0));
        drive(
            &mut state,
            FuelSample {
                caution: true,
                ..green(4, 19.0)
            },
        );
        drive(&mut state, green(5, 18.5));

        assert!(state.counted_laps().is_empty());
        assert_eq!(rejections(&state), vec![Some("caution")]);
    }

    #[test]
    fn test_off_track_lap_is_dropped() {
        let mut state = FuelState::default();

        drive(&mut state, green(4, 20.0));
        drive(
            &mut state,
            FuelSample {
                on_track: false,
                ..green(4, 19.0)
            },
        );
        drive(&mut state, green(5, 17.5));

        assert!(state.counted_laps().is_empty());
        assert_eq!(rejections(&state), vec![Some("left-track")]);
    }

    #[test]
    fn test_counter_jump_without_a_lap_is_dropped() {
        let mut state = FuelState::default();

        drive(&mut state, green(4, 20.0));
        // No back-dating: the counter advanced with no time for a lap to pass.
        state.update(green(5, 17.5));

        assert!(state.counted_laps().is_empty());
        assert_eq!(rejections(&state), vec![Some("too-short")]);
    }

    #[test]
    fn test_outlier_lap_is_dropped_but_a_normal_one_is_kept() {
        // Same session number the samples carry, or the first one would be
        // read as a session change and wipe the seeded history.
        let mut state = FuelState {
            lap_fuel_history: counted_history(&[2.5, 2.5, 2.5]),
            tracked_session_num: 1,
            ..Default::default()
        };

        drive(&mut state, green(4, 20.0));
        drive(&mut state, green(5, 15.0)); // 5.0L — double the stint's pace
        assert_eq!(state.counted_laps(), vec![2.5, 2.5, 2.5]);
        // Kept on record with its reason rather than erased from the chart.
        assert_eq!(
            state.lap_fuel_history[3].rejected.as_deref(),
            Some("outlier")
        );
        assert_eq!(state.lap_fuel_history[3].lap, 4);

        drive(&mut state, green(6, 12.4)); // 2.6L — ordinary variation
        let counted = state.counted_laps();
        assert_eq!(counted.len(), 4);
        assert!((counted[3] - 2.6).abs() < 0.001);
    }

    #[test]
    fn test_outlier_needs_a_baseline_before_it_rejects_anything() {
        assert!(!is_outlier(9.0, &[]));
        assert!(!is_outlier(9.0, &[2.5, 2.5]));
        assert!(is_outlier(9.0, &[2.5, 2.5, 2.5]));
    }

    #[test]
    fn test_outlier_keeps_laps_near_the_mean_when_the_spread_collapses() {
        // Identical laps give a zero interquartile range; without the mean
        // tolerance the fence would be a point and reject every next lap.
        assert!(!is_outlier(2.55, &[2.5, 2.5, 2.5, 2.5]));
    }
}
