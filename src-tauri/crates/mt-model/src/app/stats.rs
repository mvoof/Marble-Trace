//! Statistics: what a sim's session file holds once read, and what the main
//! window is shown of the session records kept from it.

use serde::{Deserialize, Serialize};

/// One session file as a sim's reader found it — the facts of one file, not
/// yet merged with the other files of the same session.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct SessionFile {
    /// When the file's first row was written, UTC unix seconds.
    pub started_at: i64,
    /// When its last row was written, UTC unix seconds.
    pub ended_at: i64,
    /// `None` offline: such a file is a session of its own.
    pub subsession_id: Option<i64>,
    pub session_id: Option<i64>,
    pub series_id: Option<i64>,
    pub season_id: Option<i64>,
    pub league_id: Option<i64>,
    /// The event, not the run: a race event holds practice, qualify and race.
    pub event_type: String,
    /// The licence and iRating line the session counts for.
    pub category: Option<String>,
    pub official: bool,
    pub team_racing: bool,
    pub track_id: Option<i64>,
    pub track_name: Option<String>,
    pub track_config: Option<String>,
    pub track_country: Option<String>,
    pub car_id: Option<i64>,
    pub car_name: Option<String>,
    pub car_class: Option<String>,
    pub user_id: Option<i64>,
    pub user_name: Option<String>,
    /// The snapshot at session join; a change shows from the next session.
    pub irating: Option<i64>,
    /// As the sim writes it, e.g. `B 3.74`.
    pub licence: Option<String>,
    pub runs: Vec<SessionFileRun>,
}

/// The part of one run (practice, qualify, race…) a file holds.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct SessionFileRun {
    pub session_num: i64,
    /// The sim's run type, e.g. `Race`, `Lone Qualify`.
    pub run_type: String,
    pub time_in_car_s: f64,
    /// The run's count so far: it carries over from the run's earlier files.
    pub incidents: i64,
    /// Races only, and only with the checkered flag seen in the car.
    pub finish_pos: Option<i64>,
    pub field_size: Option<i64>,
    pub laps: Vec<SessionFileLap>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct SessionFileLap {
    pub lap_num: i64,
    /// `None` when the sim did not count the lap.
    pub time_s: Option<f64>,
    /// Touched pit road: an in- or out-lap.
    pub in_pit: bool,
    /// Not started from the line: the first lap of a file, after a tow or reset.
    pub partial: bool,
    pub incidents: i64,
}

/// What the stats import is doing, on `stats://import`.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum StatsImportPhase {
    /// Nothing left to read.
    #[default]
    Idle,
    Reading,
    /// The sim is connected; reading waits for it to close.
    Paused,
    /// The game's telemetry folder was not found.
    NoFolder,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct StatsImportStatus {
    pub phase: StatsImportPhase,
    /// Files of this pass read or skipped so far.
    pub done: u32,
    /// Files this pass found unread.
    pub total: u32,
    /// Files that could not be read, all passes together.
    pub broken: u32,
}

/// One row of the recent sessions table.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecentSession {
    pub key: String,
    /// UTC unix seconds.
    pub started_at: f64,
    pub event_type: String,
    pub track_name: Option<String>,
    pub track_config: Option<String>,
    pub car_name: Option<String>,
    pub finish_pos: Option<u32>,
    pub field_size: Option<u32>,
    pub best_lap_s: Option<f64>,
    pub incidents: u32,
}
