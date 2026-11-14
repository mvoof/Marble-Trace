//! The row pass: runs, laps, incidents and the finish from the player's
//! channels.
//!
//! A lap's time settles a moment after the lap counter moves, so it is read
//! `LAP_TIME_SETTLE_S` later; -1 then means the sim did not count the lap.

use std::collections::BTreeMap;

use mt_model::app::stats::SessionFileLap;

use super::{read_f32, read_f64, read_i32, VarHeader};

/// The sim settles `LapLastLapTime` 1.5–2.1 s after the counter moves.
const LAP_TIME_SETTLE_S: f64 = 3.0;
/// At the end of a file a lap younger than this has no time yet to trust.
const LAP_TIME_MIN_SETTLE_S: f64 = 2.2;
/// `SessionState` once the checkered flag is out.
const STATE_CHECKERED: i32 = 5;

const TYPE_BOOL: i32 = 1;
const TYPE_INT: i32 = 2;
const TYPE_BITFIELD: i32 = 3;
const TYPE_FLOAT: i32 = 4;
const TYPE_DOUBLE: i32 = 5;

#[derive(Clone, Copy)]
struct Channel {
    offset: usize,
    var_type: i32,
}

impl Channel {
    fn number(self, row: &[u8]) -> f64 {
        match self.var_type {
            TYPE_BOOL => f64::from(row.get(self.offset).copied().unwrap_or_default()),
            TYPE_INT | TYPE_BITFIELD => f64::from(read_i32(row, self.offset)),
            TYPE_FLOAT => f64::from(read_f32(row, self.offset)),
            TYPE_DOUBLE => read_f64(row, self.offset),
            _ => 0.0,
        }
    }
}

/// Where the channels the stats read sit in a row.
pub(crate) struct Channels {
    session_time: Channel,
    session_num: Channel,
    lap_completed: Channel,
    session_state: Option<Channel>,
    lap_last_lap_time: Option<Channel>,
    incidents: Option<Channel>,
    on_pit_road: Option<Channel>,
    position: Option<Channel>,
}

/// One row's values.
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct Sample {
    pub session_time: f64,
    pub session_num: i64,
    pub lap_completed: i64,
    pub checkered: bool,
    pub lap_last_lap_time: Option<f64>,
    pub incidents: i64,
    pub on_pit_road: bool,
    pub position: i64,
}

impl Channels {
    pub fn find(vars: &[VarHeader]) -> Result<Self, String> {
        let find = |name: &str| {
            vars.iter().find(|var| var.name == name).map(|var| Channel {
                offset: var.offset,
                var_type: var.var_type,
            })
        };
        let required =
            |name: &str| find(name).ok_or_else(|| format!("no {name} channel in the file"));

        Ok(Self {
            session_time: required("SessionTime")?,
            session_num: required("SessionNum")?,
            lap_completed: required("LapCompleted")?,
            session_state: find("SessionState"),
            lap_last_lap_time: find("LapLastLapTime"),
            incidents: find("PlayerCarMyIncidentCount"),
            on_pit_road: find("OnPitRoad"),
            position: find("PlayerCarPosition"),
        })
    }

    pub fn read(&self, row: &[u8]) -> Sample {
        let number = |channel: Option<Channel>| channel.map(|channel| channel.number(row));

        Sample {
            session_time: self.session_time.number(row),
            session_num: self.session_num.number(row) as i64,
            lap_completed: self.lap_completed.number(row) as i64,
            checkered: number(self.session_state)
                .is_some_and(|state| state as i32 == STATE_CHECKERED),
            lap_last_lap_time: number(self.lap_last_lap_time),
            incidents: number(self.incidents).unwrap_or_default() as i64,
            on_pit_road: number(self.on_pit_road).is_some_and(|value| value != 0.0),
            position: number(self.position).unwrap_or_default() as i64,
        }
    }
}

/// What the row pass found for one run of the file.
#[derive(Debug, Default, PartialEq)]
pub(crate) struct RunSamples {
    pub time_in_car_s: f64,
    pub incidents: i64,
    pub finish_pos: Option<i64>,
    pub laps: Vec<SessionFileLap>,
}

/// A completed lap whose time has not settled yet.
#[derive(Debug, Clone, Copy)]
struct PendingLap {
    lap: SessionFileLapDraft,
    completed_at: f64,
}

#[derive(Debug, Clone, Copy)]
struct SessionFileLapDraft {
    lap_num: i64,
    in_pit: bool,
    partial: bool,
    incidents: i64,
}

impl SessionFileLapDraft {
    fn with_time(self, time_s: Option<f64>) -> SessionFileLap {
        SessionFileLap {
            lap_num: self.lap_num,
            time_s,
            in_pit: self.in_pit,
            partial: self.partial,
            incidents: self.incidents,
        }
    }
}

/// One run as the rows go by.
#[derive(Debug)]
struct RunState {
    rows: u64,
    incidents: i64,
    finish_pos: Option<i64>,
    laps: Vec<SessionFileLap>,
    lap_completed: i64,
    lap_start_incidents: i64,
    lap_in_pit: bool,
    lap_partial: bool,
    pending: Option<PendingLap>,
    /// The value the previous lap settled on: a lap reading the same never
    /// got a time of its own.
    previous_lap_time: Option<f64>,
    last_sample: Sample,
}

impl RunState {
    /// A run met mid-lap: the lap under way did not start from the line.
    fn starting_at(sample: &Sample) -> Self {
        Self {
            rows: 0,
            incidents: sample.incidents,
            finish_pos: None,
            laps: Vec::new(),
            lap_completed: sample.lap_completed,
            lap_start_incidents: sample.incidents,
            lap_in_pit: sample.on_pit_road,
            lap_partial: true,
            pending: None,
            previous_lap_time: None,
            last_sample: *sample,
        }
    }

    fn add(&mut self, sample: &Sample) {
        self.rows += 1;
        self.incidents = self.incidents.max(sample.incidents);
        self.lap_in_pit |= sample.on_pit_road;

        if sample.checkered && sample.position > 0 {
            self.finish_pos = Some(sample.position);
        }

        if let Some(pending) = self.pending {
            if sample.session_time - pending.completed_at >= LAP_TIME_SETTLE_S {
                self.pending = None;
                self.settle(pending.lap, sample.lap_last_lap_time);
            }
        }

        if sample.lap_completed > self.lap_completed {
            self.complete_lap(sample);
        } else if sample.lap_completed < self.lap_completed {
            // A reset took the counter back: whatever runs now is not a whole lap.
            self.start_lap(sample, true);
        }

        self.lap_completed = sample.lap_completed;
        self.last_sample = *sample;
    }

    fn complete_lap(&mut self, sample: &Sample) {
        // Two laps within the settle time cannot happen on a real track; the
        // older one takes the value there is.
        if let Some(pending) = self.pending.take() {
            self.settle(pending.lap, sample.lap_last_lap_time);
        }

        self.pending = Some(PendingLap {
            lap: SessionFileLapDraft {
                lap_num: sample.lap_completed,
                in_pit: self.lap_in_pit,
                partial: self.lap_partial,
                incidents: sample.incidents - self.lap_start_incidents,
            },
            completed_at: sample.session_time,
        });
        self.start_lap(sample, false);
    }

    /// Keeps a lap from the line; lap 0 (the counter leaving -1 on pit exit)
    /// and a number counted already (the counter climbing back after a reset)
    /// are not laps.
    fn settle(&mut self, lap: SessionFileLapDraft, lap_last_lap_time: Option<f64>) {
        let repeats_previous =
            lap_last_lap_time.is_some() && lap_last_lap_time == self.previous_lap_time;
        let time_s = lap_last_lap_time.filter(|time| *time > 0.0 && !repeats_previous);

        if lap_last_lap_time.is_some() {
            self.previous_lap_time = lap_last_lap_time;
        }

        if lap.lap_num < 1 || self.laps.iter().any(|kept| kept.lap_num == lap.lap_num) {
            return;
        }

        self.laps.push(lap.with_time(time_s));
    }

    fn start_lap(&mut self, sample: &Sample, partial: bool) {
        self.lap_start_incidents = sample.incidents;
        self.lap_in_pit = sample.on_pit_road;
        self.lap_partial = partial;
    }

    fn finish(mut self, tick_rate: f64) -> RunSamples {
        if let Some(pending) = self.pending.take() {
            let settled =
                self.last_sample.session_time - pending.completed_at >= LAP_TIME_MIN_SETTLE_S;
            let time = settled
                .then_some(self.last_sample.lap_last_lap_time)
                .flatten();

            self.settle(pending.lap, time);
        }

        RunSamples {
            time_in_car_s: self.rows as f64 / tick_rate,
            incidents: self.incidents,
            finish_pos: self.finish_pos,
            laps: self.laps,
        }
    }
}

/// Splits the rows by `SessionNum` into runs.
#[derive(Debug, Default)]
pub(crate) struct RunTracker {
    runs: BTreeMap<i64, RunState>,
}

impl RunTracker {
    pub fn add_row(&mut self, sample: &Sample) {
        self.runs
            .entry(sample.session_num)
            .or_insert_with(|| RunState::starting_at(sample))
            .add(sample);
    }

    pub fn finish(self, tick_rate: f64) -> BTreeMap<i64, RunSamples> {
        self.runs
            .into_iter()
            .map(|(session_num, run)| (session_num, run.finish(tick_rate)))
            .collect()
    }
}
