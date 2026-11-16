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
    /// A car in the session was driven by the sim, not a person.
    pub has_ai: bool,
    /// The track's length as the sim measures a lap, metres.
    pub track_length_m: Option<f64>,
    /// Where each sector starts, as a fraction of the lap from the line; the
    /// first is 0. Empty when the file names none.
    pub sectors: Vec<f64>,
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
    /// The run's best lap by the sim's own rule (a race skips laps with an
    /// incident); else the fastest full lap off pit road. `None` without a
    /// timed lap. May name a lap of the run's earlier file.
    pub best_lap_num: Option<i64>,
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

/// What was driven in a session, for the table's type column and filter.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
#[serde(rename_all = "camelCase")]
pub enum SessionKind {
    #[default]
    Practice,
    Qualify,
    Race,
    Test,
    TimeTrial,
}

impl SessionKind {
    pub const ALL: [SessionKind; 5] = [
        SessionKind::Practice,
        SessionKind::Qualify,
        SessionKind::Race,
        SessionKind::Test,
        SessionKind::TimeTrial,
    ];
}

/// Which sessions the table lists. Every condition narrows; an empty
/// `kinds` lists none.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionFilter {
    /// Started at or after, UTC unix seconds.
    pub from_s: Option<f64>,
    /// Started before, UTC unix seconds.
    pub to_s: Option<f64>,
    /// Part of the track or car name, any case; empty matches all.
    pub text: String,
    pub kinds: Vec<SessionKind>,
    /// Off leaves out the sessions a bot drove in.
    pub with_bots: bool,
}

impl Default for SessionFilter {
    fn default() -> Self {
        Self {
            from_s: None,
            to_s: None,
            text: String::new(),
            kinds: SessionKind::ALL.to_vec(),
            with_bots: true,
        }
    }
}

/// One page of the filtered sessions, newest first.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionPage {
    pub rows: Vec<RecentSession>,
    /// Sessions the filter matches, all pages together.
    pub total: u32,
    /// The page served, 0 first: the one asked for, or the last there is.
    pub page: u32,
    pub page_size: u32,
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
    pub kind: SessionKind,
    /// A bot drove in it.
    pub has_ai: bool,
    /// Laps completed, each once whichever files hold it.
    pub laps: u32,
    pub track_name: Option<String>,
    pub track_config: Option<String>,
    pub car_name: Option<String>,
    pub finish_pos: Option<u32>,
    pub field_size: Option<u32>,
    pub best_lap_s: Option<f64>,
    pub incidents: u32,
}

/// What Home shows above the recent sessions: the last seven days next to the
/// seven before, the calendar, the top lists and the last race.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct HomeStats {
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

/// One span of days in figures, the sessions started in it, all categories
/// together.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct WeekStats {
    pub time_in_car_s: f64,
    /// The track's length × its full laps; a session read before the length
    /// was stored adds none.
    pub km: f64,
    /// Laps from the line, each once whichever files hold it.
    pub full_laps: u32,
    /// Full laps without an incident.
    pub clean_laps: u32,
    /// The track and car pairs whose fastest lap so far was set in the span,
    /// in the order they were driven.
    pub personal_bests: Vec<PersonalBest>,
}

/// A new fastest lap on a track in a car: the sim's best lap of a session,
/// faster than any before it on the pair, or the pair's first.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PersonalBest {
    pub track_name: Option<String>,
    pub car_name: Option<String>,
    pub lap_time_s: f64,
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
