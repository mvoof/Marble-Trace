//! The sessions table: filtered and paged in SQLite, newest first.

use rusqlite::{params, OptionalExtension, Row};

use mt_model::app::stats::{RecentSession, SessionFilter, SessionKind, SessionPage};

use crate::db::{to_message, StatsDb, RACE_RUN_TYPE, STATUS_READ};

/// Rows of one page of the table.
pub const SESSIONS_PAGE_SIZE: u32 = 20;

/// Every read session with what the table and its filter need. `?1` is the
/// read status, `?2` the race run type.
const SESSIONS_CTE: &str = "
WITH listed AS (
  SELECT s.key, MIN(f.started_at) AS started, s.event_type, s.track_name, s.track_config,
         s.car_name, s.has_ai,
         CASE
           WHEN s.event_type = 'Test'
             OR EXISTS (SELECT 1 FROM run r WHERE r.session_key = s.key
                        AND r.run_type LIKE '%Testing%') THEN 'test'
           WHEN s.event_type = 'Time Trial'
             OR EXISTS (SELECT 1 FROM run r WHERE r.session_key = s.key
                        AND r.run_type = 'Time Trial') THEN 'timeTrial'
           WHEN EXISTS (SELECT 1 FROM run r WHERE r.session_key = s.key
                        AND r.run_type = ?2) THEN 'race'
           WHEN EXISTS (SELECT 1 FROM run r WHERE r.session_key = s.key
                        AND r.run_type LIKE '%Qualify%') THEN 'qualify'
           ELSE 'practice'
         END AS kind,
         (SELECT COUNT(*) FROM (SELECT DISTINCT session_num, lap_num FROM lap
                                WHERE lap.session_key = s.key)) AS laps
  FROM session s
  JOIN ibt_file f ON f.session_key = s.key AND f.status = ?1
  GROUP BY s.key
)";

/// The filter's conditions on `listed`: `?3` from, `?4` to, `?5` the text as
/// a LIKE pattern, `?6` the kinds as `,a,b,`, `?7` with bots.
const FILTER_WHERE: &str = "
WHERE (?3 IS NULL OR started >= ?3)
  AND (?4 IS NULL OR started < ?4)
  AND (?5 = '%%' OR track_name LIKE ?5 ESCAPE '\\' OR track_config LIKE ?5 ESCAPE '\\'
       OR car_name LIKE ?5 ESCAPE '\\')
  AND instr(?6, ',' || kind || ',') > 0
  AND (?7 OR has_ai = 0)";

const ROW_COLUMNS: &str =
    "SELECT key, started, event_type, track_name, track_config, car_name, has_ai, kind, laps
     FROM listed";

impl StatsDb {
    /// One page of the sessions `filter` lets through; a page past the end
    /// serves the last one.
    pub fn sessions_page(&self, filter: &SessionFilter, page: u32) -> Result<SessionPage, String> {
        let total = self.count_sessions(filter)?;
        let last_page = total.saturating_sub(1) / SESSIONS_PAGE_SIZE;
        let page = page.min(last_page);
        let rows = self.listed_rows(filter, SESSIONS_PAGE_SIZE, page * SESSIONS_PAGE_SIZE)?;

        Ok(SessionPage {
            rows,
            total,
            page,
            page_size: SESSIONS_PAGE_SIZE,
        })
    }

    /// The latest sessions first, each merged from all its files.
    pub fn recent_sessions(&self, limit: u32) -> Result<Vec<RecentSession>, String> {
        self.listed_rows(&SessionFilter::default(), limit, 0)
    }

    /// One session as the table shows it; `None` when it is not read.
    pub(crate) fn session_row(&self, key: &str) -> Result<Option<RecentSession>, String> {
        let sql = format!("{SESSIONS_CTE} {ROW_COLUMNS} WHERE key = ?3");

        let row = self
            .connection
            .query_row(&sql, params![STATUS_READ, RACE_RUN_TYPE, key], listed_row)
            .optional()
            .map_err(to_message)?;

        row.map(|session| self.with_results(session)).transpose()
    }

    fn count_sessions(&self, filter: &SessionFilter) -> Result<u32, String> {
        let sql = format!("{SESSIONS_CTE} SELECT COUNT(*) FROM listed {FILTER_WHERE}");
        let (text, kinds) = filter_params(filter);

        self.connection
            .query_row(
                &sql,
                params![
                    STATUS_READ,
                    RACE_RUN_TYPE,
                    filter.from_s,
                    filter.to_s,
                    text,
                    kinds,
                    filter.with_bots
                ],
                |row| row.get(0),
            )
            .map_err(to_message)
    }

    fn listed_rows(
        &self,
        filter: &SessionFilter,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<RecentSession>, String> {
        let sql = format!(
            "{SESSIONS_CTE} {ROW_COLUMNS} {FILTER_WHERE}
             ORDER BY started DESC, key LIMIT ?8 OFFSET ?9"
        );
        let (text, kinds) = filter_params(filter);
        let mut statement = self.connection.prepare(&sql).map_err(to_message)?;
        let rows = statement
            .query_map(
                params![
                    STATUS_READ,
                    RACE_RUN_TYPE,
                    filter.from_s,
                    filter.to_s,
                    text,
                    kinds,
                    filter.with_bots,
                    limit,
                    offset
                ],
                listed_row,
            )
            .map_err(to_message)?;

        rows.map(|row| {
            let session = row.map_err(to_message)?;

            self.with_results(session)
        })
        .collect()
    }
}

/// (the text as a LIKE pattern, the kinds as `,a,b,`).
fn filter_params(filter: &SessionFilter) -> (String, String) {
    let escaped: String = filter
        .text
        .trim()
        .chars()
        .flat_map(|character| match character {
            '%' | '_' | '\\' => vec!['\\', character],
            _ => vec![character],
        })
        .collect();
    let kinds: String = filter
        .kinds
        .iter()
        .map(|kind| format!("{},", kind_name(*kind)))
        .collect();

    (format!("%{escaped}%"), format!(",{kinds}"))
}

const fn kind_name(kind: SessionKind) -> &'static str {
    match kind {
        SessionKind::Practice => "practice",
        SessionKind::Qualify => "qualify",
        SessionKind::Race => "race",
        SessionKind::Test => "test",
        SessionKind::TimeTrial => "timeTrial",
    }
}

fn kind_from_name(name: &str) -> SessionKind {
    SessionKind::ALL
        .into_iter()
        .find(|kind| kind_name(*kind) == name)
        .unwrap_or_default()
}

/// A row of `ROW_COLUMNS`, before its results are added.
fn listed_row(row: &Row) -> rusqlite::Result<RecentSession> {
    let kind: String = row.get(7)?;

    Ok(RecentSession {
        key: row.get(0)?,
        started_at: row.get::<_, i64>(1)? as f64,
        event_type: row.get(2)?,
        track_name: row.get(3)?,
        track_config: row.get(4)?,
        car_name: row.get(5)?,
        has_ai: row.get(6)?,
        kind: kind_from_name(&kind),
        laps: row.get(8)?,
        finish_pos: None,
        field_size: None,
        best_lap_s: None,
        incidents: 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::FileStamp;
    use mt_model::app::stats::{SessionFile, SessionFileLap, SessionFileRun};

    const DAY_S: i64 = 24 * 60 * 60;

    fn session(id: i64, started_at: i64, run_type: &str, track: &str, car: &str) -> SessionFile {
        SessionFile {
            started_at,
            ended_at: started_at + 600,
            subsession_id: Some(id),
            event_type: if run_type == "Race" || run_type == "Practice" {
                "Race".into()
            } else {
                run_type.into()
            },
            track_name: Some(track.into()),
            car_name: Some(car.into()),
            runs: vec![SessionFileRun {
                session_num: 0,
                run_type: run_type.into(),
                laps: (1..=3)
                    .map(|lap_num| SessionFileLap {
                        lap_num,
                        time_s: Some(100.0),
                        ..SessionFileLap::default()
                    })
                    .collect(),
                ..SessionFileRun::default()
            }],
            ..SessionFile::default()
        }
    }

    fn db_with(files: &[SessionFile]) -> StatsDb {
        let mut db = StatsDb::open_in_memory().unwrap();

        for (index, file) in files.iter().enumerate() {
            let stamp = FileStamp {
                path: format!("{index}.ibt"),
                size: 1,
                modified_at: 1,
            };
            db.record_read(&stamp, file, 1).unwrap();
        }

        db
    }

    fn keys(page: &SessionPage) -> Vec<&str> {
        page.rows.iter().map(|row| row.key.as_str()).collect()
    }

    fn sample() -> StatsDb {
        let mut bots = session(5, 50 * DAY_S, "Race", "Okayama", "Formula Vee");
        bots.has_ai = true;

        db_with(&[
            session(
                1,
                10 * DAY_S,
                "Practice",
                "Spa-Francorchamps",
                "Porsche 911 GT3 R",
            ),
            session(2, 20 * DAY_S, "Lone Qualify", "Monza", "BMW M4 GT3"),
            session(3, 30 * DAY_S, "Race", "Spa-Francorchamps", "BMW M4 GT3"),
            session(4, 40 * DAY_S, "Test", "Road Atlanta", "Mazda MX-5"),
            bots,
        ])
    }

    #[test]
    fn the_default_filter_lists_every_session_newest_first_with_kind_and_laps() {
        let page = sample()
            .sessions_page(&SessionFilter::default(), 0)
            .unwrap();

        assert_eq!(
            keys(&page),
            vec!["sub:5", "sub:4", "sub:3", "sub:2", "sub:1"]
        );
        assert_eq!(page.total, 5);
        let kinds: Vec<SessionKind> = page.rows.iter().map(|row| row.kind).collect();
        assert_eq!(
            kinds,
            vec![
                SessionKind::Race,
                SessionKind::Test,
                SessionKind::Race,
                SessionKind::Qualify,
                SessionKind::Practice,
            ]
        );
        assert!(page.rows[0].has_ai);
        assert_eq!(page.rows[0].laps, 3);
    }

    #[test]
    fn a_period_keeps_the_sessions_started_in_it() {
        let filter = SessionFilter {
            from_s: Some((20 * DAY_S) as f64),
            to_s: Some((40 * DAY_S) as f64),
            ..SessionFilter::default()
        };

        assert_eq!(
            keys(&sample().sessions_page(&filter, 0).unwrap()),
            vec!["sub:3", "sub:2"]
        );
    }

    #[test]
    fn the_text_matches_the_track_or_the_car_in_any_case() {
        let db = sample();
        let search = |text: &str| SessionFilter {
            text: text.into(),
            ..SessionFilter::default()
        };

        assert_eq!(
            keys(&db.sessions_page(&search("spa"), 0).unwrap()),
            vec!["sub:3", "sub:1"]
        );
        assert_eq!(
            keys(&db.sessions_page(&search(" bmw "), 0).unwrap()),
            vec!["sub:3", "sub:2"]
        );
        assert!(db
            .sessions_page(&search("100%"), 0)
            .unwrap()
            .rows
            .is_empty());
    }

    #[test]
    fn the_kinds_and_the_bots_switch_narrow() {
        let db = sample();
        let races = SessionFilter {
            kinds: vec![SessionKind::Race],
            ..SessionFilter::default()
        };
        let races_without_bots = SessionFilter {
            with_bots: false,
            ..races.clone()
        };
        let none = SessionFilter {
            kinds: Vec::new(),
            ..SessionFilter::default()
        };

        assert_eq!(
            keys(&db.sessions_page(&races, 0).unwrap()),
            vec!["sub:5", "sub:3"]
        );
        assert_eq!(
            keys(&db.sessions_page(&races_without_bots, 0).unwrap()),
            vec!["sub:3"]
        );
        assert_eq!(db.sessions_page(&none, 0).unwrap().total, 0);
    }

    #[test]
    fn pages_hold_twenty_and_a_page_past_the_end_serves_the_last() {
        let files: Vec<SessionFile> = (1..=45)
            .map(|id| session(id, id * DAY_S, "Practice", "Spa", "BMW"))
            .collect();
        let db = db_with(&files);
        let filter = SessionFilter::default();

        let first = db.sessions_page(&filter, 0).unwrap();
        let last = db.sessions_page(&filter, 9).unwrap();

        assert_eq!((first.rows.len(), first.total, first.page), (20, 45, 0));
        assert_eq!(first.rows[0].key, "sub:45");
        assert_eq!((last.rows.len(), last.page), (5, 2));
        assert_eq!(last.rows[4].key, "sub:1");
    }

    #[test]
    fn an_empty_list_is_page_zero_of_none() {
        let db = StatsDb::open_in_memory().unwrap();

        let page = db.sessions_page(&SessionFilter::default(), 3).unwrap();

        assert_eq!((page.rows.len(), page.total, page.page), (0, 0, 0));
    }
}
