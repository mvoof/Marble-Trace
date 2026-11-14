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
    /// The track drawn from the file's fastest clean lap; `None` without one.
    pub outline: Option<TrackOutline>,
}

/// A track's shape as an SVG path, north up when drawn from positions.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TrackOutline {
    pub svg_path: String,
    pub view_box: String,
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

/// What Home shows above the recent sessions: the licence and iRating of
/// each category driven, and the last seven days next to the seven before.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct HomeStats {
    /// The category of the latest session first.
    pub ratings: Vec<CategoryRating>,
    /// The seven days up to now.
    pub week: WeekStats,
    /// The seven days before those.
    pub previous_week: WeekStats,
    /// The sessions of the calendar's span spent in the car, oldest first.
    pub driven: Vec<DrivenSession>,
    /// The cars driven longest, all time, the longest first.
    pub top_cars: Vec<TimeDriven>,
    /// The tracks driven longest, all time, the longest first.
    pub top_tracks: Vec<TimeDriven>,
    /// The latest session that held a race; `None` before the first.
    pub last_race: Option<LastRace>,
}

/// The latest race, as Home's last-race card shows it.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LastRace {
    pub session: RecentSession,
    /// The iRating the next session in its category joined with, against the
    /// one it joined with: unknown until that next session is driven, and for
    /// a race offline.
    pub irating_change: Option<i32>,
    pub track_id: Option<i32>,
    /// As the sim writes it, e.g. `Germany`.
    pub track_country: Option<String>,
    /// From the session files read, else the shape the track map recorded.
    pub outline: Option<TrackOutline>,
}

/// Whether the sim writes a telemetry file each time the driver gets in the
/// car — where statistics come from.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AutologState {
    On,
    Off,
    /// The sim's settings file, or the setting in it, was not found.
    Unknown,
}

/// One session of the days-driven calendar.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DrivenSession {
    pub key: String,
    /// UTC unix seconds.
    pub started_at: f64,
    /// All its runs and files together; never 0.
    pub time_in_car_s: f64,
    pub track_name: Option<String>,
    pub car_name: Option<String>,
}

/// A car or a track and the time spent in the car on it.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimeDriven {
    pub name: String,
    pub time_in_car_s: f64,
}

/// One licence and iRating line: the sessions online in one category.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CategoryRating {
    /// As the sim writes it, e.g. `Sports Car`.
    pub category: String,
    /// The latest session's, e.g. `B 3.74`.
    pub licence: Option<String>,
    /// The latest session's: the snapshot at its join.
    pub irating: u32,
    /// The latest iRating against the one before the last seven days; 0 when
    /// nothing was driven in them.
    pub week_change: i32,
    /// UTC unix seconds.
    pub last_session_at: f64,
    /// Oldest first, one point a session.
    pub history: Vec<RatingPoint>,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RatingPoint {
    pub key: String,
    /// UTC unix seconds.
    pub started_at: f64,
    /// The snapshot at join: a session's own result shows from the next one.
    pub irating: u32,
    pub track_name: Option<String>,
}

/// Sessions, laps and incidents of one span of days, all categories together.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct WeekStats {
    pub sessions: u32,
    /// Sessions of a race event; the rest are practice and test.
    pub races: u32,
    /// Laps completed, whole or not.
    pub laps: u32,
    pub incidents: u32,
}

/// Where the stats import reads session files from.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StatsFolder {
    /// `None` when no folder was chosen and the sim's own was not found.
    pub path: Option<String>,
    /// The sim's own folder, not one the driver chose.
    pub is_default: bool,
}

/// A car the driver has a session record in: what the auto-switch rules offer
/// while the sim is off.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KnownCar {
    pub car_id: i32,
    pub car_name: Option<String>,
    /// The class badge the live session would give it, else the sim's class
    /// name; `None` when neither is known.
    pub car_class: Option<String>,
}

/// A session file the import could not read; not retried until it changes.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SkippedFile {
    pub path: String,
    /// What the reader said.
    pub error: Option<String>,
    /// When it was tried, UTC unix seconds.
    pub read_at: f64,
}
