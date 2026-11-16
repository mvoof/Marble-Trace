//! What Home shows above the recent sessions: the last seven days of
//! driving, the calendar, the top lists and the last race.

use std::collections::HashMap;

use rusqlite::params;

use mt_model::app::stats::{
    DrivenSession, HomeStats, LastRace, RecentSession, TimeDriven, WeekStats,
};

use crate::db::{to_message, StatsDb, RACE_RUN_TYPE, STATUS_READ};

const DAY_S: i64 = 24 * 60 * 60;
const WEEK_S: i64 = 7 * DAY_S;
const RACE_EVENT_TYPE: &str = "Race";
/// The calendar's span: 53 weeks, so its first column is always whole.
const CALENDAR_DAYS: i64 = 53 * 7;
/// Entries of each top list.
const TOP_LIMIT: usize = 5;

/// One session as Home needs it, merged from its files.
#[derive(Debug, Clone)]
struct SessionSummary {
    key: String,
    started_at: i64,
    event_type: String,
    track_name: Option<String>,
    track_config: Option<String>,
    track_id: Option<i64>,
    track_country: Option<String>,
    car_name: Option<String>,
    /// All its runs and files together.
    time_in_car_s: f64,
    /// It holds a race run, not only the practice of a race event.
    raced: bool,
}

impl StatsDb {
    /// Home's figures as they stand at `now`, UTC unix seconds.
    pub fn home_stats(&self, now: i64) -> Result<HomeStats, String> {
        let sessions = self.session_summaries()?;
        let week_start = now - WEEK_S;
        let previous_week_start = week_start - WEEK_S;

        Ok(HomeStats {
            week: self.week_stats(&sessions, week_start, now)?,
            previous_week: self.week_stats(&sessions, previous_week_start, week_start)?,
            driven: driven_sessions(&sessions, now - CALENDAR_DAYS * DAY_S),
            top_cars: top_by_time(&sessions, |session| session.car_name.as_deref()),
            top_tracks: top_by_time(&sessions, |session| session.track_name.as_deref()),
            last_race: self.last_race(&sessions)?,
        })
    }

    /// Every session read, oldest first.
    fn session_summaries(&self) -> Result<Vec<SessionSummary>, String> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT s.key, MIN(f.started_at) AS started, s.event_type,
                        s.track_name, s.car_name,
                        (SELECT COALESCE(SUM(r.time_in_car_s), 0) FROM run r
                         WHERE r.session_key = s.key),
                        s.track_config,
                        EXISTS (SELECT 1 FROM run raced WHERE raced.session_key = s.key
                                AND raced.run_type = ?2),
                        s.track_id, s.track_country
                 FROM session s
                 JOIN ibt_file f ON f.session_key = s.key AND f.status = ?1
                 GROUP BY s.key
                 ORDER BY started ASC",
            )
            .map_err(to_message)?;
        let rows = statement
            .query_map(params![STATUS_READ, RACE_RUN_TYPE], |row| {
                Ok(SessionSummary {
                    key: row.get(0)?,
                    started_at: row.get(1)?,
                    event_type: row.get(2)?,
                    track_name: row.get(3)?,
                    car_name: row.get(4)?,
                    time_in_car_s: row.get(5)?,
                    track_config: row.get(6)?,
                    raced: row.get(7)?,
                    track_id: row.get(8)?,
                    track_country: row.get(9)?,
                })
            })
            .map_err(to_message)?;

        rows.map(|row| row.map_err(to_message)).collect()
    }

    /// The sessions started in `[from, to)`.
    fn week_stats(
        &self,
        sessions: &[SessionSummary],
        from: i64,
        to: i64,
    ) -> Result<WeekStats, String> {
        let mut week = WeekStats::default();

        for session in sessions
            .iter()
            .filter(|session| session.started_at >= from && session.started_at < to)
        {
            week.sessions += 1;

            if session.event_type == RACE_EVENT_TYPE {
                week.races += 1;
            }

            week.laps += self.session_laps(&session.key)?;
            week.incidents += self.session_incidents(&session.key)?;
        }

        Ok(week)
    }

    /// The latest session that held a race, with its results. `sessions` is
    /// oldest first.
    fn last_race(&self, sessions: &[SessionSummary]) -> Result<Option<LastRace>, String> {
        let Some(index) = sessions.iter().rposition(|session| session.raced) else {
            return Ok(None);
        };
        let race = &sessions[index];
        let session = self.with_results(RecentSession {
            key: race.key.clone(),
            started_at: race.started_at as f64,
            event_type: race.event_type.clone(),
            track_name: race.track_name.clone(),
            track_config: race.track_config.clone(),
            car_name: race.car_name.clone(),
            finish_pos: None,
            field_size: None,
            best_lap_s: None,
            incidents: 0,
        })?;

        Ok(Some(LastRace {
            session,
            track_id: race
                .track_id
                .and_then(|track_id| i32::try_from(track_id).ok()),
            track_country: race.track_country.clone(),
            outline: race
                .track_id
                .map(|track_id| self.track_outline(track_id))
                .transpose()?
                .flatten(),
        }))
    }

    /// A lap is counted once, whichever of the session's files hold it.
    fn session_laps(&self, key: &str) -> Result<u32, String> {
        self.connection
            .query_row(
                "SELECT COUNT(*) FROM (
                   SELECT DISTINCT session_num, lap_num FROM lap WHERE session_key = ?1
                 )",
                params![key],
                |row| row.get(0),
            )
            .map_err(to_message)
    }
}

/// The sessions started from `from` on with time in the car; a session only
/// sat in the garage leaves the calendar empty.
fn driven_sessions(sessions: &[SessionSummary], from: i64) -> Vec<DrivenSession> {
    sessions
        .iter()
        .filter(|session| session.started_at >= from && session.time_in_car_s > 0.0)
        .map(|session| DrivenSession {
            key: session.key.clone(),
            started_at: session.started_at as f64,
            time_in_car_s: session.time_in_car_s,
            track_name: session.track_name.clone(),
            car_name: session.car_name.clone(),
        })
        .collect()
}

/// The names `name_of` gives the sessions, by the time spent in the car
/// under each, the longest first.
fn top_by_time(
    sessions: &[SessionSummary],
    name_of: impl Fn(&SessionSummary) -> Option<&str>,
) -> Vec<TimeDriven> {
    let mut by_name: HashMap<&str, f64> = HashMap::new();

    for session in sessions
        .iter()
        .filter(|session| session.time_in_car_s > 0.0)
    {
        if let Some(name) = name_of(session) {
            *by_name.entry(name).or_default() += session.time_in_car_s;
        }
    }

    let mut ranked: Vec<TimeDriven> = by_name
        .into_iter()
        .map(|(name, time_in_car_s)| TimeDriven {
            name: name.to_owned(),
            time_in_car_s,
        })
        .collect();

    ranked.sort_by(|left, right| {
        right
            .time_in_car_s
            .total_cmp(&left.time_in_car_s)
            .then_with(|| left.name.cmp(&right.name))
    });
    ranked.truncate(TOP_LIMIT);

    ranked
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::FileStamp;
    use mt_model::app::stats::{SessionFile, SessionFileLap, SessionFileRun, TrackOutline};

    const NOW: i64 = 100 * WEEK_S;

    fn stamp(path: &str) -> FileStamp {
        FileStamp {
            path: path.into(),
            size: 100,
            modified_at: 1_000,
        }
    }

    fn online(subsession_id: i64, started_at: i64, category: &str, irating: i64) -> SessionFile {
        SessionFile {
            started_at,
            ended_at: started_at + 600,
            subsession_id: Some(subsession_id),
            event_type: "Race".into(),
            category: Some(category.into()),
            irating: Some(irating),
            licence: Some(format!("B {irating}")),
            track_name: Some(format!("Track {subsession_id}")),
            ..SessionFile::default()
        }
    }

    fn laps(count: i64) -> Vec<SessionFileLap> {
        (1..=count)
            .map(|lap_num| SessionFileLap {
                lap_num,
                time_s: Some(100.0),
                ..SessionFileLap::default()
            })
            .collect()
    }

    fn run(incidents: i64, lap_count: i64) -> SessionFileRun {
        SessionFileRun {
            session_num: 1,
            run_type: "Race".into(),
            incidents,
            laps: laps(lap_count),
            ..SessionFileRun::default()
        }
    }

    fn db_with(files: &[SessionFile]) -> StatsDb {
        let mut db = StatsDb::open_in_memory().unwrap();

        for (index, file) in files.iter().enumerate() {
            db.record_read(&stamp(&format!("{index}.ibt")), file, 5)
                .unwrap();
        }

        db
    }

    #[test]
    fn the_week_and_the_week_before_count_apart() {
        let mut practice = online(3, NOW - 9 * DAY_S, "Oval", 1300);
        practice.event_type = "Practice".into();
        practice.runs = vec![run(1, 10)];
        let mut race = online(1, NOW - DAY_S, "Sports Car", 2000);
        race.runs = vec![run(4, 20)];
        let mut offline = online(0, NOW - 2 * DAY_S, "Sports Car", 2000);
        offline.event_type = "Test".into();
        offline.runs = vec![run(0, 5)];

        let stats = db_with(&[practice, race, offline]).home_stats(NOW).unwrap();

        assert_eq!(
            (stats.week, stats.previous_week),
            (
                WeekStats {
                    sessions: 2,
                    races: 1,
                    laps: 25,
                    incidents: 4,
                },
                WeekStats {
                    sessions: 1,
                    races: 0,
                    laps: 10,
                    incidents: 1,
                }
            )
        );
    }

    #[test]
    fn a_lap_held_by_two_files_counts_once() {
        let mut first = online(1, NOW - DAY_S, "Sports Car", 2000);
        first.runs = vec![run(2, 3)];
        let mut second = online(1, NOW - DAY_S + 300, "Sports Car", 2000);
        second.runs = vec![run(3, 4)];

        let week = db_with(&[first, second]).home_stats(NOW).unwrap().week;

        assert_eq!((week.sessions, week.laps, week.incidents), (1, 4, 3));
    }

    fn driven_in(
        subsession_id: i64,
        started_at: i64,
        car: &str,
        track: &str,
        seconds: f64,
    ) -> SessionFile {
        SessionFile {
            car_name: Some(car.into()),
            track_name: Some(track.into()),
            runs: vec![SessionFileRun {
                time_in_car_s: seconds,
                ..run(0, 1)
            }],
            ..online(subsession_id, started_at, "Sports Car", 2000)
        }
    }

    #[test]
    fn the_calendar_holds_the_sessions_of_its_span_spent_in_the_car() {
        let mut two_files = driven_in(3, NOW - DAY_S, "BMW", "Spa", 600.0);
        let mut second_file = driven_in(3, NOW - DAY_S + 700, "BMW", "Spa", 300.0);
        two_files.runs[0].session_num = 1;
        second_file.runs[0].session_num = 2;
        let db = db_with(&[
            driven_in(1, NOW - CALENDAR_DAYS * DAY_S - 1, "BMW", "Spa", 900.0),
            driven_in(2, NOW - 3 * DAY_S, "BMW", "Spa", 0.0),
            two_files,
            second_file,
        ]);

        let driven = db.home_stats(NOW).unwrap().driven;
        let seen: Vec<(i64, f64)> = driven
            .iter()
            .map(|session| (session.started_at as i64, session.time_in_car_s))
            .collect();

        assert_eq!(seen, vec![(NOW - DAY_S, 900.0)]);
        assert_eq!(driven[0].car_name.as_deref(), Some("BMW"));
        assert_eq!(driven[0].track_name.as_deref(), Some("Spa"));
    }

    fn raced(subsession_id: i64, started_at: i64, category: &str, irating: i64) -> SessionFile {
        SessionFile {
            runs: vec![SessionFileRun {
                finish_pos: Some(4),
                field_size: Some(22),
                ..run(3, 5)
            }],
            ..online(subsession_id, started_at, category, irating)
        }
    }

    #[test]
    fn the_last_race_is_the_latest_session_with_a_race_run() {
        let mut practice_only = online(3, NOW - DAY_S, "Sports Car", 2050);
        practice_only.runs = vec![SessionFileRun {
            run_type: "Practice".into(),
            ..run(1, 2)
        }];
        let db = db_with(&[
            raced(1, NOW - 3 * DAY_S, "Sports Car", 2000),
            raced(2, NOW - 2 * DAY_S, "Sports Car", 2010),
            practice_only,
        ]);

        let last_race = db.home_stats(NOW).unwrap().last_race.unwrap();

        assert_eq!(last_race.session.track_name.as_deref(), Some("Track 2"));
        assert_eq!(
            (
                last_race.session.finish_pos,
                last_race.session.field_size,
                last_race.session.incidents,
                last_race.session.best_lap_s,
            ),
            (Some(4), Some(22), 3, Some(100.0))
        );
    }

    fn outline(svg_path: &str) -> TrackOutline {
        TrackOutline {
            svg_path: svg_path.into(),
            view_box: "0 0 10 10".into(),
        }
    }

    #[test]
    fn the_last_race_carries_its_country_and_the_first_outline_of_its_track() {
        let on_track = |file: SessionFile, drawn: Option<TrackOutline>| SessionFile {
            track_id: Some(262),
            track_country: Some("Germany".into()),
            outline: drawn,
            ..file
        };
        let db = db_with(&[
            on_track(online(1, NOW - 3 * DAY_S, "Sports Car", 2000), None),
            on_track(
                online(2, NOW - 2 * DAY_S, "Sports Car", 2000),
                Some(outline("M 0 0 Z")),
            ),
            on_track(
                raced(3, NOW - DAY_S, "Sports Car", 2010),
                Some(outline("M 1 1 Z")),
            ),
        ]);

        let last_race = db.home_stats(NOW).unwrap().last_race.unwrap();

        assert_eq!(last_race.track_id, Some(262));
        assert_eq!(last_race.track_country.as_deref(), Some("Germany"));
        assert_eq!(last_race.outline, Some(outline("M 0 0 Z")));
    }

    #[test]
    fn a_track_never_drawn_has_no_outline() {
        let db = db_with(&[SessionFile {
            track_id: Some(1),
            ..raced(1, NOW - DAY_S, "Sports Car", 2000)
        }]);

        assert_eq!(db.home_stats(NOW).unwrap().last_race.unwrap().outline, None);
    }

    #[test]
    fn no_race_no_card() {
        let none = db_with(&[online(1, NOW - DAY_S, "Sports Car", 2000)]);

        assert_eq!(none.home_stats(NOW).unwrap().last_race, None);
    }

    #[test]
    fn the_top_lists_rank_cars_and_tracks_by_time_all_time() {
        let mut files = vec![
            driven_in(1, NOW - 400 * DAY_S, "Porsche", "Monza", 3_000.0),
            driven_in(2, NOW - 5 * DAY_S, "BMW", "Spa", 1_000.0),
            driven_in(3, NOW - 4 * DAY_S, "BMW", "Monza", 1_500.0),
            driven_in(4, NOW - 3 * DAY_S, "Ferrari", "Spa", 0.0),
        ];
        files.extend(
            (10..20).map(|id| driven_in(id, NOW - DAY_S, &format!("Car {id}"), "Imola", 10.0)),
        );

        let stats = db_with(&files).home_stats(NOW).unwrap();
        let ranked = |list: &[TimeDriven]| -> Vec<(String, f64)> {
            list.iter()
                .map(|entry| (entry.name.clone(), entry.time_in_car_s))
                .collect()
        };

        assert_eq!(stats.top_cars.len(), TOP_LIMIT);
        assert_eq!(
            ranked(&stats.top_cars[..2]),
            vec![("Porsche".into(), 3_000.0), ("BMW".into(), 2_500.0)]
        );
        assert_eq!(
            ranked(&stats.top_tracks),
            vec![
                ("Monza".into(), 4_500.0),
                ("Spa".into(), 1_000.0),
                ("Imola".into(), 100.0),
            ]
        );
    }
}
