//! What Home shows above the recent sessions: the last seven days of
//! driving, the calendar, the top lists and the last race.

use std::collections::HashMap;

use rusqlite::params;

use mt_model::app::stats::{
    DrivenSession, HomeStats, LastRace, PersonalBest, TimeDriven, WeekStats,
};

use crate::db::{to_message, StatsDb, RACE_RUN_TYPE, STATUS_READ};

const DAY_S: i64 = 24 * 60 * 60;
const WEEK_S: i64 = 7 * DAY_S;
const METRES_PER_KM: f64 = 1000.0;
/// Entries of each top list.
const TOP_LIMIT: usize = 5;
const PODIUM_LAST: u32 = 3;
const TOP_TEN_LAST: u32 = 10;

/// One session as Home needs it, merged from its files.
#[derive(Debug, Clone)]
struct SessionSummary {
    key: String,
    started_at: i64,
    track_name: Option<String>,
    track_id: Option<i64>,
    track_country: Option<String>,
    track_length_m: Option<f64>,
    car_id: Option<i64>,
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
        let bests = self.session_best_laps()?;
        let week_start = now - WEEK_S;
        let previous_week_start = week_start - WEEK_S;

        Ok(HomeStats {
            week: self.week_stats(&sessions, &bests, week_start, now)?,
            previous_week: self.week_stats(&sessions, &bests, previous_week_start, week_start)?,
            driven: driven_sessions(&sessions),
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
                        s.track_id, s.track_country, s.track_length_m, s.car_id
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
                    track_name: row.get(3)?,
                    car_name: row.get(4)?,
                    time_in_car_s: row.get(5)?,
                    raced: row.get(7)?,
                    track_id: row.get(8)?,
                    track_country: row.get(9)?,
                    track_length_m: row.get(10)?,
                    car_id: row.get(11)?,
                })
            })
            .map_err(to_message)?;

        rows.map(|row| row.map_err(to_message)).collect()
    }

    /// The sessions started in `[from, to)`. `sessions` is oldest first.
    fn week_stats(
        &self,
        sessions: &[SessionSummary],
        bests: &HashMap<String, f64>,
        from: i64,
        to: i64,
    ) -> Result<WeekStats, String> {
        let mut week = WeekStats {
            personal_bests: personal_bests(sessions, bests, from, to),
            ..WeekStats::default()
        };

        for session in sessions
            .iter()
            .filter(|session| session.started_at >= from && session.started_at < to)
        {
            let (full_laps, clean_laps) = self.session_full_laps(&session.key)?;

            week.time_in_car_s += session.time_in_car_s;
            week.full_laps += full_laps;
            week.clean_laps += clean_laps;
            week.km +=
                session.track_length_m.unwrap_or_default() / METRES_PER_KM * f64::from(full_laps);

            if !session.raced {
                continue;
            }

            let (Some(finish_pos), _) = self.session_finish(&session.key)? else {
                continue;
            };

            week.races += 1;
            week.wins += u32::from(finish_pos == 1);
            week.podiums += u32::from(finish_pos <= PODIUM_LAST);
            week.top_tens += u32::from(finish_pos <= TOP_TEN_LAST);
        }

        Ok(week)
    }

    /// Each session's best lap by the sim's rule (`run.best_lap_num`), by key.
    fn session_best_laps(&self) -> Result<HashMap<String, f64>, String> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT r.session_key, MIN(l.time_s)
                 FROM run r
                 JOIN lap l ON l.session_key = r.session_key
                   AND l.session_num = r.session_num AND l.lap_num = r.best_lap_num
                 WHERE l.time_s IS NOT NULL
                 GROUP BY r.session_key",
            )
            .map_err(to_message)?;
        let rows = statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(to_message)?;

        rows.map(|row| row.map_err(to_message)).collect()
    }

    /// (full laps, clean laps): laps from the line, each counted once whichever
    /// of the session's files hold it, and those of them without an incident.
    fn session_full_laps(&self, key: &str) -> Result<(u32, u32), String> {
        self.connection
            .query_row(
                "SELECT COUNT(*), COALESCE(SUM(incidents = 0), 0) FROM (
                   SELECT MIN(partial) AS partial, MAX(incidents) AS incidents
                   FROM lap WHERE session_key = ?1
                   GROUP BY session_num, lap_num
                 ) WHERE partial = 0",
                params![key],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(to_message)
    }

    /// The latest session that held a race, with its results. `sessions` is
    /// oldest first.
    fn last_race(&self, sessions: &[SessionSummary]) -> Result<Option<LastRace>, String> {
        let Some(index) = sessions.iter().rposition(|session| session.raced) else {
            return Ok(None);
        };
        let race = &sessions[index];
        let Some(session) = self.session_row(&race.key)? else {
            return Ok(None);
        };

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
}

/// The track and car pairs whose fastest lap so far fell in `[from, to)`:
/// faster there than every session before `from`, or never driven before.
/// `sessions` is oldest first; a session without a track or car id is no pair.
fn personal_bests(
    sessions: &[SessionSummary],
    bests: &HashMap<String, f64>,
    from: i64,
    to: i64,
) -> Vec<PersonalBest> {
    let mut record_before: HashMap<(i64, i64), f64> = HashMap::new();
    let mut in_span: Vec<((i64, i64), PersonalBest)> = Vec::new();

    for session in sessions.iter().filter(|session| session.started_at < to) {
        let (Some(track_id), Some(car_id), Some(&lap_time_s)) =
            (session.track_id, session.car_id, bests.get(&session.key))
        else {
            continue;
        };
        let pair = (track_id, car_id);

        if session.started_at < from {
            let record = record_before.entry(pair).or_insert(lap_time_s);
            *record = record.min(lap_time_s);

            continue;
        }

        let beats_before = record_before
            .get(&pair)
            .is_none_or(|record| lap_time_s < *record);

        match in_span.iter_mut().find(|(seen, _)| *seen == pair) {
            Some((_, best)) => best.lap_time_s = best.lap_time_s.min(lap_time_s),
            None if beats_before => in_span.push((
                pair,
                PersonalBest {
                    track_name: session.track_name.clone(),
                    car_name: session.car_name.clone(),
                    lap_time_s,
                },
            )),
            None => {}
        }
    }

    in_span.into_iter().map(|(_, best)| best).collect()
}

/// Every session with time in the car, for the calendar's years; a session
/// only sat in the garage leaves the calendar empty.
fn driven_sessions(sessions: &[SessionSummary]) -> Vec<DrivenSession> {
    sessions
        .iter()
        .filter(|session| session.time_in_car_s > 0.0)
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

    fn laps_with(lap_count: i64, incidents_on: &[i64], partial_on: &[i64]) -> Vec<SessionFileLap> {
        (1..=lap_count)
            .map(|lap_num| SessionFileLap {
                lap_num,
                time_s: Some(100.0),
                incidents: i64::from(incidents_on.contains(&lap_num)),
                partial: partial_on.contains(&lap_num),
                ..SessionFileLap::default()
            })
            .collect()
    }

    fn on_track(
        subsession_id: i64,
        started_at: i64,
        length_m: f64,
        seconds: f64,
        laps: Vec<SessionFileLap>,
    ) -> SessionFile {
        SessionFile {
            track_length_m: Some(length_m),
            runs: vec![SessionFileRun {
                time_in_car_s: seconds,
                laps,
                ..run(0, 0)
            }],
            ..online(subsession_id, started_at, "Sports Car", 2000)
        }
    }

    #[test]
    fn the_week_and_the_week_before_count_apart() {
        let db = db_with(&[
            on_track(
                1,
                NOW - 9 * DAY_S,
                4_000.0,
                1_800.0,
                laps_with(10, &[2], &[]),
            ),
            on_track(
                2,
                NOW - 2 * DAY_S,
                5_000.0,
                3_000.0,
                laps_with(20, &[3, 4], &[1]),
            ),
            on_track(3, NOW - DAY_S, 2_000.0, 600.0, laps_with(5, &[], &[])),
        ]);

        let stats = db.home_stats(NOW).unwrap();

        assert_eq!(stats.week.time_in_car_s, 3_600.0);
        assert_eq!(stats.week.km, 5.0 * 19.0 + 2.0 * 5.0);
        assert_eq!((stats.week.full_laps, stats.week.clean_laps), (24, 22));
        assert_eq!(stats.previous_week.time_in_car_s, 1_800.0);
        assert_eq!(stats.previous_week.km, 40.0);
        assert_eq!(
            (
                stats.previous_week.full_laps,
                stats.previous_week.clean_laps
            ),
            (10, 9)
        );
    }

    #[test]
    fn a_week_without_sessions_is_all_zero() {
        let db = db_with(&[on_track(1, NOW - 30 * DAY_S, 4_000.0, 600.0, laps(5))]);

        let stats = db.home_stats(NOW).unwrap();

        assert_eq!(stats.week, WeekStats::default());
        assert_eq!(stats.previous_week, WeekStats::default());
    }

    #[test]
    fn a_session_read_before_its_track_length_adds_laps_but_no_km() {
        let mut file = on_track(1, NOW - DAY_S, 4_000.0, 600.0, laps(5));
        file.track_length_m = None;

        let week = db_with(&[file]).home_stats(NOW).unwrap().week;

        assert_eq!((week.full_laps, week.km), (5, 0.0));
    }

    #[test]
    fn a_lap_held_by_two_files_counts_once() {
        let mut first = online(1, NOW - DAY_S, "Sports Car", 2000);
        first.runs = vec![run(2, 3)];
        let mut second = online(1, NOW - DAY_S + 300, "Sports Car", 2000);
        second.runs = vec![run(3, 4)];

        let week = db_with(&[first, second]).home_stats(NOW).unwrap().week;

        assert_eq!(week.full_laps, 4);
    }

    /// A session on `track` in `car` whose sim best is `best_s`.
    fn best_on(
        subsession_id: i64,
        started_at: i64,
        track: i64,
        car: i64,
        best_s: f64,
    ) -> SessionFile {
        SessionFile {
            track_id: Some(track),
            car_id: Some(car),
            track_name: Some(format!("Track {track}")),
            car_name: Some(format!("Car {car}")),
            runs: vec![SessionFileRun {
                best_lap_num: Some(2),
                laps: vec![
                    SessionFileLap {
                        lap_num: 1,
                        time_s: Some(best_s - 1.0),
                        partial: true,
                        ..SessionFileLap::default()
                    },
                    SessionFileLap {
                        lap_num: 2,
                        time_s: Some(best_s),
                        ..SessionFileLap::default()
                    },
                ],
                ..run(0, 0)
            }],
            ..online(subsession_id, started_at, "Sports Car", 2000)
        }
    }

    #[test]
    fn a_personal_best_is_a_pairs_new_fastest_lap_or_its_first() {
        let db = db_with(&[
            best_on(1, NOW - 30 * DAY_S, 1, 1, 100.0),
            best_on(2, NOW - 30 * DAY_S, 1, 2, 100.0),
            best_on(3, NOW - 10 * DAY_S, 1, 1, 99.5),
            best_on(4, NOW - 3 * DAY_S, 1, 1, 99.8),
            best_on(5, NOW - 2 * DAY_S, 1, 1, 99.0),
            best_on(6, NOW - 2 * DAY_S, 1, 2, 101.0),
            best_on(7, NOW - DAY_S, 2, 1, 120.0),
        ]);

        let stats = db.home_stats(NOW).unwrap();
        let bests: Vec<(Option<&str>, Option<&str>, f64)> = stats
            .week
            .personal_bests
            .iter()
            .map(|best| {
                (
                    best.track_name.as_deref(),
                    best.car_name.as_deref(),
                    best.lap_time_s,
                )
            })
            .collect();

        // The partial lap 1 is faster, but the sim's best is lap 2.
        assert_eq!(
            bests,
            vec![
                (Some("Track 1"), Some("Car 1"), 99.0),
                (Some("Track 2"), Some("Car 1"), 120.0),
            ]
        );
        assert_eq!(stats.previous_week.personal_bests.len(), 1);
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
    fn the_calendar_holds_every_session_spent_in_the_car() {
        let mut two_files = driven_in(3, NOW - DAY_S, "BMW", "Spa", 600.0);
        let mut second_file = driven_in(3, NOW - DAY_S + 700, "BMW", "Spa", 300.0);
        two_files.runs[0].session_num = 1;
        second_file.runs[0].session_num = 2;
        let db = db_with(&[
            driven_in(1, NOW - 400 * DAY_S, "BMW", "Spa", 900.0),
            driven_in(2, NOW - 3 * DAY_S, "BMW", "Spa", 0.0),
            two_files,
            second_file,
        ]);

        let driven = db.home_stats(NOW).unwrap().driven;
        let seen: Vec<(i64, f64)> = driven
            .iter()
            .map(|session| (session.started_at as i64, session.time_in_car_s))
            .collect();

        assert_eq!(seen, vec![(NOW - 400 * DAY_S, 900.0), (NOW - DAY_S, 900.0)]);
        assert_eq!(driven[1].car_name.as_deref(), Some("BMW"));
        assert_eq!(driven[1].track_name.as_deref(), Some("Spa"));
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

    fn finished(subsession_id: i64, started_at: i64, finish_pos: Option<i64>) -> SessionFile {
        let mut file = raced(subsession_id, started_at, "Sports Car", 2000);
        file.runs[0].finish_pos = finish_pos;

        file
    }

    #[test]
    fn the_week_counts_its_races_by_where_they_finished() {
        let db = db_with(&[
            finished(1, NOW - 5 * DAY_S, Some(1)),
            finished(2, NOW - 4 * DAY_S, Some(3)),
            finished(3, NOW - 3 * DAY_S, Some(7)),
            finished(4, NOW - 2 * DAY_S, Some(15)),
            finished(5, NOW - DAY_S, None),
            finished(6, NOW - 10 * DAY_S, Some(1)),
        ]);

        let week = db.home_stats(NOW).unwrap().week;

        assert_eq!(
            (week.races, week.wins, week.podiums, week.top_tens),
            (4, 1, 2, 3)
        );
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
