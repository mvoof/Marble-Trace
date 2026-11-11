use std::time::Instant;

use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::session_memory::{SessionMemory, FIRST_LAP};
use crate::{ComputeContext, ComputedOutput, Processor, ProcessorCommand, ProcessorId, TickRate};
use mt_model::contract::capabilities::Capabilities;
use mt_model::sim::player::{CarStatusFrame, LapTimingFrame};
use mt_model::sim::session::SessionSnapshot;

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

/// The pit window, the refuel buffer and the widget's own "pit now" threshold
/// all describe the same one-lap cushion, and the frontend reads it too — so it
/// is declared once, on the contract, along with the two fuel defaults.
pub use mt_model::contract::defaults::{
    DEFAULT_FUEL_AVG_WINDOW, DEFAULT_PIT_WARNING_LAPS, PIT_WINDOW_END_BUFFER_LAPS,
};

/// User-tunable fuel parameters, snapshotted once per tick.
#[derive(Debug, Clone, Copy)]
pub struct FuelSettings {
    pub pit_warning_laps: f32,
    pub avg_window: usize,
    /// Count laps run under a local (sector) yellow. On a road course a
    /// waved yellow rarely slows the lap enough to matter for fuel; a
    /// full-course caution or a red is always dropped.
    pub count_local_yellow_laps: bool,
}

impl Default for FuelSettings {
    fn default() -> Self {
        Self {
            pit_warning_laps: DEFAULT_PIT_WARNING_LAPS,
            avg_window: DEFAULT_FUEL_AVG_WINDOW,
            count_local_yellow_laps: false,
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
    /// A flag is out that the user wants the lap dropped for — the lap is not
    /// run at racing pace.
    pub caution: bool,
}

/// One completed lap as measured, kept whether or not it counts.
///
/// A rejected lap still burned fuel and still happened, so it belongs in the
/// history the widget draws — dropping it silently left the chart unable to say
/// which lap any bar referred to. `rejected` carries why it does not count.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
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

/// The session's lap records, kept across a restart.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub struct FuelMemory {
    pub session_num: i32,
    pub laps: Vec<FuelLapRecord>,
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
    /// History came back from a restart and no lap has been seen to judge it by.
    resuming: bool,
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
            resuming: false,
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

    /// Takes the history back. The lap in progress was not watched from its
    /// start, so it stays unmeasured: no start fuel, and `finish_lap` skips it.
    pub fn resume(&mut self, memory: &FuelMemory) {
        *self = Self {
            lap_fuel_history: memory.laps.clone(),
            tracked_session_num: memory.session_num,
            resuming: !memory.laps.is_empty(),
            ..Self::default()
        };
    }

    /// Judges resumed history by the first real lap number, and takes that lap
    /// as the one in progress. A lap counter already past the history's last
    /// lap carries on; one that is not means the session restarted meanwhile.
    fn settle_resume(&mut self, lap: i32) {
        self.resuming = false;
        self.last_lap = lap;

        if self
            .lap_fuel_history
            .last()
            .is_some_and(|record| record.lap >= lap)
        {
            self.lap_fuel_history.clear();
        }
    }

    pub fn update(&mut self, sample: FuelSample) {
        if sample.session_num != self.tracked_session_num {
            self.reset();
            self.tracked_session_num = sample.session_num;
        }

        if self.resuming {
            if sample.lap < FIRST_LAP {
                return;
            }

            self.settle_resume(sample.lap);
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

/// Last, average, minimum and maximum consumption over the *whole* recorded
/// history, deliberately ignoring the user's averaging window.
///
/// That window already drives `avg_per_lap` and every strategy figure with it;
/// repeating it here would make the stats row restate the summary instead of
/// adding to it. Reading the two side by side is what tells the driver whether
/// the current pace runs richer or leaner than the stint has averaged.
///
/// Rejected laps are skipped outright, so an out-lap or a lap behind the safety
/// car cannot become MIN or MAX however far it sits from the rest.
#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct FuelHistoryStats {
    pub last: Option<f32>,
    pub avg: Option<f32>,
    pub min: Option<f32>,
    pub max: Option<f32>,
}

/// How the outstanding fuel is split across the stops left to make.
///
/// Splitting the total evenly would recommend an amount no real stop uses:
/// drivers fill to the brim early and take the remainder last, so `fill_now` is
/// capped by tank capacity rather than divided.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct RefuelPlan {
    /// Stops needed to take on the whole amount; 1 when a single tank covers it.
    pub stops: i32,
    /// What to dial in at this stop — a full tank while more stops remain.
    pub fill_now: f32,
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
    pub history_stats: FuelHistoryStats,
    /// How `fuel_to_add_with_buffer` splits across the stops left to make —
    /// the buffered figure, because that is the one both the widget and the pit
    /// order dial in. `None` when nothing has to be added.
    pub refuel_plan: Option<RefuelPlan>,
}

/// Walks the counted laps once for all four figures.
pub fn history_stats(history: &[FuelLapRecord]) -> FuelHistoryStats {
    let mut stats = FuelHistoryStats::default();
    let mut sum = 0.0;
    let mut count = 0u32;

    for record in history.iter().filter(|record| record.counts()) {
        stats.last = Some(record.used);
        stats.min = Some(
            stats
                .min
                .map_or(record.used, |min: f32| min.min(record.used)),
        );
        stats.max = Some(
            stats
                .max
                .map_or(record.used, |max: f32| max.max(record.used)),
        );

        sum += record.used;
        count += 1;
    }

    if count > 0 {
        stats.avg = Some(sum / count as f32);
    }

    stats
}

/// The refuel split for an outstanding amount, a tank capacity and what is
/// already on board.
///
/// This stop is bounded by the *free* space in the tank, not by the tank: a car
/// running 50 L of a 65 L tank cannot take 30 L however much it needs, and a
/// figure the sim would silently clamp is the one number the driver must not be
/// given — it is what the pit order dials in.
///
/// An unknown or nonsensical capacity still yields a single stop: the driver
/// gets the honest total rather than nothing at all.
pub fn refuel_plan(
    fuel_to_add: Option<f32>,
    fuel_max: Option<f32>,
    fuel_level: f32,
) -> Option<RefuelPlan> {
    let to_add = fuel_to_add.filter(|value| *value > 0.0)?;

    let Some(max) = fuel_max.filter(|value| *value > 0.0) else {
        return Some(RefuelPlan {
            stops: 1,
            fill_now: to_add,
        });
    };

    // A level the sim has not reported yet reads as zero, and a full tank that
    // still wants fuel is a contradiction — both fall back to the capacity cap
    // rather than recommending a stop that takes nothing.
    let free = (max - fuel_level.max(0.0)).min(max);

    if free <= 0.0 {
        return Some(RefuelPlan {
            stops: (to_add / max).ceil() as i32,
            fill_now: to_add.min(max),
        });
    }

    if to_add <= free {
        return Some(RefuelPlan {
            stops: 1,
            fill_now: to_add,
        });
    }

    // The first stop is capped by the space there is now; every stop after it
    // starts from a tank drained low enough to take a full one.
    Some(RefuelPlan {
        stops: 1 + ((to_add - free) / max).ceil() as i32,
        fill_now: free,
    })
}

/// Laps the player still has to drive, from where the car is, and whether the
/// session runs on the clock rather than on a lap count. A timed session is
/// estimated from the time left and the best lap (the last one until there is
/// a best); `None` while neither lap time exists.
fn laps_to_finish(
    lap_timing: &LapTimingFrame,
    session: &SessionSnapshot,
    session_num: Option<i32>,
    session_time_remain: Option<f64>,
) -> (Option<f32>, bool) {
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

    (laps_to_finish, is_timed_race)
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

    let (laps_to_finish, is_timed_race) =
        laps_to_finish(lap_timing, session, session_num, session_time_remain);

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
        history_stats: history_stats(&fuel_state.lap_fuel_history),
        refuel_plan: refuel_plan(
            fuel_to_add_with_buffer,
            session.fuel_capacity_ltr,
            fuel_level,
        ),
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
        let local_yellow = flags.yellow || flags.yellow_waving;
        let full_course = flags.caution || flags.caution_waving || flags.red;

        self.state.update(FuelSample {
            lap: ctx.lap_timing.lap.unwrap_or(-1),
            fuel_level: ctx.car_status.fuel_level,
            session_num: ctx.session_num.unwrap_or(-1),
            on_track: ctx.car_status.is_on_track.unwrap_or(true),
            caution: full_course || (local_yellow && !ctx.fuel_settings.count_local_yellow_laps),
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

    fn command(&mut self, command: &ProcessorCommand) {
        if let ProcessorCommand::ResumeSession(memory) = command {
            self.state.resume(&memory.fuel);
        }
    }

    fn remember(&self, memory: &mut SessionMemory) {
        memory.fuel = FuelMemory {
            session_num: self.state.tracked_session_num,
            laps: self.state.lap_fuel_history.clone(),
        };
    }
}

#[cfg(test)]
mod tests;
