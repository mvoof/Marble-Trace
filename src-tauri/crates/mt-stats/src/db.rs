//! `stats.db`: the rows of each file read, merged into sessions when read back.
//!
//! A run and its laps are stored per file, never summed on write: a file read
//! again (it grew, or the import was interrupted) replaces its own rows and
//! nothing else, and the order files arrive in does not matter. The session
//! row holds only what every file of a session agrees on.

use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension, Transaction};

use mt_model::app::stats::{RecentSession, SessionFile};

/// Bumped with every schema step; `migrate` runs the steps above the file's.
const SCHEMA_VERSION: i64 = 1;

const SCHEMA_V1: &str = "
CREATE TABLE session (
  key            TEXT PRIMARY KEY,
  subsession_id  INTEGER,
  session_id     INTEGER,
  series_id      INTEGER,
  season_id      INTEGER,
  league_id      INTEGER,
  event_type     TEXT NOT NULL,
  category       TEXT,
  official       INTEGER NOT NULL,
  team_racing    INTEGER NOT NULL,
  track_id       INTEGER,
  track_name     TEXT,
  track_config   TEXT,
  track_country  TEXT,
  car_id         INTEGER,
  car_name       TEXT,
  car_class      TEXT,
  user_id        INTEGER,
  user_name      TEXT,
  irating        INTEGER,
  licence        TEXT
);

CREATE TABLE ibt_file (
  path         TEXT PRIMARY KEY,
  size         INTEGER NOT NULL,
  modified_at  INTEGER NOT NULL,
  status       TEXT NOT NULL,
  error        TEXT,
  read_at      INTEGER NOT NULL,
  session_key  TEXT REFERENCES session(key),
  started_at   INTEGER,
  ended_at     INTEGER
);
CREATE INDEX ibt_file_session ON ibt_file(session_key);

CREATE TABLE run (
  path           TEXT NOT NULL REFERENCES ibt_file(path) ON DELETE CASCADE,
  session_num    INTEGER NOT NULL,
  session_key    TEXT NOT NULL,
  run_type       TEXT NOT NULL,
  time_in_car_s  REAL NOT NULL,
  incidents      INTEGER NOT NULL,
  finish_pos     INTEGER,
  field_size     INTEGER,
  PRIMARY KEY (path, session_num)
);
CREATE INDEX run_session ON run(session_key);

CREATE TABLE lap (
  path         TEXT NOT NULL,
  session_num  INTEGER NOT NULL,
  lap_num      INTEGER NOT NULL,
  session_key  TEXT NOT NULL,
  time_s       REAL,
  in_pit       INTEGER NOT NULL,
  partial      INTEGER NOT NULL,
  incidents    INTEGER NOT NULL,
  PRIMARY KEY (path, session_num, lap_num),
  FOREIGN KEY (path, session_num) REFERENCES run(path, session_num) ON DELETE CASCADE
);
CREATE INDEX lap_session ON lap(session_key);
";

pub(crate) const STATUS_READ: &str = "read";
const STATUS_BROKEN: &str = "broken";
const RACE_RUN_TYPE: &str = "Race";

/// A file on disk as the scan saw it: a changed size or time means read again.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileStamp {
    pub path: String,
    /// Bytes.
    pub size: i64,
    /// Unix seconds.
    pub modified_at: i64,
}

pub struct StatsDb {
    pub(crate) connection: Connection,
}

impl StatsDb {
    pub fn open(path: &Path) -> Result<Self, String> {
        Self::prepared(Connection::open(path).map_err(to_message)?)
    }

    pub fn open_in_memory() -> Result<Self, String> {
        Self::prepared(Connection::open_in_memory().map_err(to_message)?)
    }

    fn prepared(connection: Connection) -> Result<Self, String> {
        connection
            .pragma_update(None, "foreign_keys", true)
            .map_err(to_message)?;
        migrate(&connection)?;

        Ok(Self { connection })
    }

    /// Every file seen, read or broken, with the stamp it had then.
    pub fn known_files(&self) -> Result<HashMap<String, FileStamp>, String> {
        let mut statement = self
            .connection
            .prepare("SELECT path, size, modified_at FROM ibt_file")
            .map_err(to_message)?;
        let rows = statement
            .query_map([], |row| {
                Ok(FileStamp {
                    path: row.get(0)?,
                    size: row.get(1)?,
                    modified_at: row.get(2)?,
                })
            })
            .map_err(to_message)?;

        rows.map(|row| {
            row.map(|stamp| (stamp.path.clone(), stamp))
                .map_err(to_message)
        })
        .collect()
    }

    /// Stores what one file held, replacing whatever an earlier read of it
    /// stored.
    pub fn record_read(
        &mut self,
        stamp: &FileStamp,
        file: &SessionFile,
        read_at: i64,
    ) -> Result<(), String> {
        let key = session_key(file);
        let transaction = self.connection.transaction().map_err(to_message)?;

        insert_session(&transaction, &key, file)?;
        upsert_file(
            &transaction,
            stamp,
            FileOutcome::Read { key: &key, file },
            read_at,
        )?;
        transaction
            .execute("DELETE FROM run WHERE path = ?1", params![stamp.path])
            .map_err(to_message)?;
        insert_runs(&transaction, &stamp.path, &key, file)?;

        transaction.commit().map_err(to_message)
    }

    /// Marks a file that could not be read, so the next pass skips it until
    /// it changes on disk.
    pub fn record_broken(
        &mut self,
        stamp: &FileStamp,
        error: &str,
        read_at: i64,
    ) -> Result<(), String> {
        let transaction = self.connection.transaction().map_err(to_message)?;

        transaction
            .execute("DELETE FROM run WHERE path = ?1", params![stamp.path])
            .map_err(to_message)?;
        upsert_file(&transaction, stamp, FileOutcome::Broken(error), read_at)?;

        transaction.commit().map_err(to_message)
    }

    pub fn broken_count(&self) -> Result<u32, String> {
        self.connection
            .query_row(
                "SELECT COUNT(*) FROM ibt_file WHERE status = ?1",
                params![STATUS_BROKEN],
                |row| row.get(0),
            )
            .map_err(to_message)
    }

    /// The latest sessions first, each merged from all its files.
    pub fn recent_sessions(&self, limit: u32) -> Result<Vec<RecentSession>, String> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT s.key, MIN(f.started_at) AS started, s.event_type, s.track_name,
                        s.track_config, s.car_name
                 FROM session s
                 JOIN ibt_file f ON f.session_key = s.key AND f.status = ?1
                 GROUP BY s.key
                 ORDER BY started DESC
                 LIMIT ?2",
            )
            .map_err(to_message)?;
        let rows = statement
            .query_map(params![STATUS_READ, limit], |row| {
                Ok(RecentSession {
                    key: row.get(0)?,
                    started_at: row.get::<_, i64>(1)? as f64,
                    event_type: row.get(2)?,
                    track_name: row.get(3)?,
                    track_config: row.get(4)?,
                    car_name: row.get(5)?,
                    finish_pos: None,
                    field_size: None,
                    best_lap_s: None,
                    incidents: 0,
                })
            })
            .map_err(to_message)?;

        rows.map(|row| {
            let session = row.map_err(to_message)?;

            self.with_results(session)
        })
        .collect()
    }

    fn with_results(&self, session: RecentSession) -> Result<RecentSession, String> {
        let best_lap_s = self
            .connection
            .query_row(
                "SELECT MIN(time_s) FROM lap
                 WHERE session_key = ?1 AND time_s IS NOT NULL AND in_pit = 0 AND partial = 0",
                params![session.key],
                |row| row.get(0),
            )
            .map_err(to_message)?;
        let incidents = self.session_incidents(&session.key)?;
        // The last race of the session, as its latest file saw the flag. The
        // field size comes from the latest file whose results list the race:
        // the one at the flag often opened before the results were out.
        let finish: Option<(Option<u32>, Option<u32>)> = self
            .connection
            .query_row(
                "SELECT r.finish_pos, (
                   SELECT sized.field_size FROM run sized
                   JOIN ibt_file sized_file ON sized_file.path = sized.path
                   WHERE sized.session_key = r.session_key AND sized.session_num = r.session_num
                     AND sized.field_size IS NOT NULL
                   ORDER BY sized_file.started_at DESC
                   LIMIT 1
                 )
                 FROM run r
                 JOIN ibt_file f ON f.path = r.path
                 WHERE r.session_key = ?1 AND r.run_type = ?2 AND r.finish_pos IS NOT NULL
                 ORDER BY r.session_num DESC, f.started_at DESC
                 LIMIT 1",
                params![session.key, RACE_RUN_TYPE],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(to_message)?;
        let (finish_pos, field_size) = finish.unwrap_or((None, None));

        Ok(RecentSession {
            finish_pos,
            field_size,
            best_lap_s,
            incidents,
            ..session
        })
    }

    /// A run's count carries over between its files: the largest is the run's.
    pub(crate) fn session_incidents(&self, key: &str) -> Result<u32, String> {
        self.connection
            .query_row(
                "SELECT COALESCE(SUM(run_max), 0) FROM (
                   SELECT MAX(incidents) AS run_max FROM run
                   WHERE session_key = ?1 GROUP BY session_num
                 )",
                params![key],
                |row| row.get(0),
            )
            .map_err(to_message)
    }
}

enum FileOutcome<'a> {
    Read { key: &'a str, file: &'a SessionFile },
    Broken(&'a str),
}

/// Online files group by their subsession; an offline file is a session of
/// its own.
fn session_key(file: &SessionFile) -> String {
    match file.subsession_id {
        Some(id) if id > 0 => format!("sub:{id}"),
        _ => format!(
            "file:{}:{}:{}",
            file.started_at,
            file.track_id.unwrap_or_default(),
            file.car_id.unwrap_or_default()
        ),
    }
}

fn migrate(connection: &Connection) -> Result<(), String> {
    let version: i64 = connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(to_message)?;

    if version < 1 {
        connection.execute_batch(SCHEMA_V1).map_err(to_message)?;
    }

    connection
        .pragma_update(None, "user_version", SCHEMA_VERSION)
        .map_err(to_message)
}

/// The first file of a session writes its row; later ones leave it.
fn insert_session(transaction: &Transaction, key: &str, file: &SessionFile) -> Result<(), String> {
    transaction
        .execute(
            "INSERT OR IGNORE INTO session (
               key, subsession_id, session_id, series_id, season_id, league_id, event_type,
               category, official, team_racing, track_id, track_name, track_config,
               track_country, car_id, car_name, car_class, user_id, user_name, irating, licence
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16,
                       ?17, ?18, ?19, ?20, ?21)",
            params![
                key,
                file.subsession_id,
                file.session_id,
                file.series_id,
                file.season_id,
                file.league_id,
                file.event_type,
                file.category,
                file.official,
                file.team_racing,
                file.track_id,
                file.track_name,
                file.track_config,
                file.track_country,
                file.car_id,
                file.car_name,
                file.car_class,
                file.user_id,
                file.user_name,
                file.irating,
                file.licence,
            ],
        )
        .map(|_| ())
        .map_err(to_message)
}

fn upsert_file(
    transaction: &Transaction,
    stamp: &FileStamp,
    outcome: FileOutcome,
    read_at: i64,
) -> Result<(), String> {
    let (status, error, key, started_at, ended_at) = match outcome {
        FileOutcome::Read { key, file } => (
            STATUS_READ,
            None,
            Some(key),
            Some(file.started_at),
            Some(file.ended_at),
        ),
        FileOutcome::Broken(error) => (STATUS_BROKEN, Some(error), None, None, None),
    };

    transaction
        .execute(
            "INSERT INTO ibt_file
               (path, size, modified_at, status, error, read_at, session_key, started_at, ended_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(path) DO UPDATE SET
               size = excluded.size, modified_at = excluded.modified_at,
               status = excluded.status, error = excluded.error, read_at = excluded.read_at,
               session_key = excluded.session_key, started_at = excluded.started_at,
               ended_at = excluded.ended_at",
            params![
                stamp.path,
                stamp.size,
                stamp.modified_at,
                status,
                error,
                read_at,
                key,
                started_at,
                ended_at,
            ],
        )
        .map(|_| ())
        .map_err(to_message)
}

fn insert_runs(
    transaction: &Transaction,
    path: &str,
    key: &str,
    file: &SessionFile,
) -> Result<(), String> {
    for run in &file.runs {
        transaction
            .execute(
                "INSERT INTO run (path, session_num, session_key, run_type, time_in_car_s,
                                  incidents, finish_pos, field_size)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    path,
                    run.session_num,
                    key,
                    run.run_type,
                    run.time_in_car_s,
                    run.incidents,
                    run.finish_pos,
                    run.field_size,
                ],
            )
            .map_err(to_message)?;

        for lap in &run.laps {
            transaction
                .execute(
                    "INSERT OR REPLACE INTO lap (path, session_num, lap_num, session_key, time_s,
                                                 in_pit, partial, incidents)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        path,
                        run.session_num,
                        lap.lap_num,
                        key,
                        lap.time_s,
                        lap.in_pit,
                        lap.partial,
                        lap.incidents,
                    ],
                )
                .map_err(to_message)?;
        }
    }

    Ok(())
}

pub(crate) fn to_message(error: rusqlite::Error) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use mt_model::app::stats::{SessionFileLap, SessionFileRun};

    fn stamp(path: &str) -> FileStamp {
        FileStamp {
            path: path.into(),
            size: 100,
            modified_at: 1_000,
        }
    }

    fn lap(lap_num: i64, time_s: Option<f64>) -> SessionFileLap {
        SessionFileLap {
            lap_num,
            time_s,
            in_pit: false,
            partial: false,
            incidents: 0,
        }
    }

    fn race_file(started_at: i64) -> SessionFile {
        SessionFile {
            started_at,
            ended_at: started_at + 600,
            subsession_id: Some(77),
            event_type: "Race".into(),
            track_id: Some(252),
            track_name: Some("Nürburgring".into()),
            car_name: Some("Mercedes-AMG GT3".into()),
            ..SessionFile::default()
        }
    }

    fn race_run(incidents: i64, laps: Vec<SessionFileLap>) -> SessionFileRun {
        SessionFileRun {
            session_num: 2,
            run_type: "Race".into(),
            time_in_car_s: 600.0,
            incidents,
            laps,
            ..SessionFileRun::default()
        }
    }

    #[test]
    fn two_files_of_one_subsession_are_one_session() {
        let mut db = StatsDb::open_in_memory().unwrap();

        let mut first = race_file(1_000);
        first.runs = vec![race_run(4, vec![lap(1, Some(500.0)), lap(2, Some(490.0))])];
        let mut second = race_file(2_000);
        second.runs = vec![SessionFileRun {
            finish_pos: Some(14),
            field_size: Some(50),
            ..race_run(12, vec![lap(3, Some(495.0)), lap(4, None)])
        }];

        db.record_read(&stamp("b.ibt"), &second, 5).unwrap();
        db.record_read(&stamp("a.ibt"), &first, 5).unwrap();

        let sessions = db.recent_sessions(10).unwrap();

        assert_eq!(
            sessions,
            vec![RecentSession {
                key: "sub:77".into(),
                started_at: 1_000.0,
                event_type: "Race".into(),
                track_name: Some("Nürburgring".into()),
                track_config: None,
                car_name: Some("Mercedes-AMG GT3".into()),
                finish_pos: Some(14),
                field_size: Some(50),
                best_lap_s: Some(490.0),
                incidents: 12,
            }]
        );
    }

    #[test]
    fn a_file_read_again_replaces_its_own_rows() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let mut file = race_file(1_000);
        file.runs = vec![race_run(3, vec![lap(1, Some(500.0))])];
        db.record_read(&stamp("a.ibt"), &file, 5).unwrap();

        file.runs = vec![race_run(5, vec![lap(1, Some(500.0)), lap(2, Some(480.0))])];
        db.record_read(&stamp("a.ibt"), &file, 6).unwrap();

        let session = &db.recent_sessions(10).unwrap()[0];
        assert_eq!(session.incidents, 5);
        assert_eq!(session.best_lap_s, Some(480.0));
    }

    #[test]
    fn pit_and_partial_laps_never_are_the_best_lap() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let mut file = race_file(1_000);
        file.runs = vec![race_run(
            0,
            vec![
                SessionFileLap {
                    partial: true,
                    ..lap(1, Some(300.0))
                },
                SessionFileLap {
                    in_pit: true,
                    ..lap(2, Some(310.0))
                },
                lap(3, Some(500.0)),
            ],
        )];
        db.record_read(&stamp("a.ibt"), &file, 5).unwrap();

        assert_eq!(db.recent_sessions(10).unwrap()[0].best_lap_s, Some(500.0));
    }

    #[test]
    fn offline_files_are_sessions_of_their_own() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let offline = |started_at| SessionFile {
            subsession_id: Some(0),
            ..race_file(started_at)
        };
        db.record_read(&stamp("a.ibt"), &offline(1_000), 5).unwrap();
        db.record_read(&stamp("b.ibt"), &offline(2_000), 5).unwrap();

        let started: Vec<f64> = db
            .recent_sessions(10)
            .unwrap()
            .iter()
            .map(|session| session.started_at)
            .collect();
        assert_eq!(started, vec![2_000.0, 1_000.0]);
    }

    #[test]
    fn a_broken_file_is_known_and_counted_but_no_session() {
        let mut db = StatsDb::open_in_memory().unwrap();
        db.record_broken(&stamp("bad.ibt"), "truncated", 5).unwrap();

        assert_eq!(db.broken_count().unwrap(), 1);
        assert!(db.known_files().unwrap().contains_key("bad.ibt"));
        assert!(db.recent_sessions(10).unwrap().is_empty());
    }

    #[test]
    fn the_field_size_comes_from_any_file_of_the_race() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let mut early = race_file(1_000);
        early.runs = vec![SessionFileRun {
            field_size: Some(48),
            ..race_run(0, Vec::new())
        }];
        let mut flag = race_file(2_000);
        flag.runs = vec![SessionFileRun {
            finish_pos: Some(20),
            ..race_run(0, Vec::new())
        }];
        db.record_read(&stamp("a.ibt"), &early, 5).unwrap();
        db.record_read(&stamp("b.ibt"), &flag, 5).unwrap();

        let session = &db.recent_sessions(10).unwrap()[0];
        assert_eq!(
            (session.finish_pos, session.field_size),
            (Some(20), Some(48))
        );
    }

    #[test]
    fn a_practice_has_no_finish() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let mut file = race_file(1_000);
        file.runs = vec![SessionFileRun {
            run_type: "Practice".into(),
            finish_pos: Some(3),
            ..race_run(0, Vec::new())
        }];
        db.record_read(&stamp("a.ibt"), &file, 5).unwrap();

        assert_eq!(db.recent_sessions(10).unwrap()[0].finish_pos, None);
    }
}
