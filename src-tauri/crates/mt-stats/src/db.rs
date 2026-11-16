//! `stats.db`: the rows of each file read, merged into sessions when read back.
//!
//! A run and its laps are stored per file, never summed on write: a file read
//! again (it grew, or the import was interrupted) replaces its own rows and
//! nothing else, and the order files arrive in does not matter. The session
//! row holds only what every file of a session agrees on.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension, Transaction};

use mt_model::app::car_setup::CarSetupView;
use mt_model::app::lap_telemetry::LapKey;
use mt_model::app::stats::{
    KnownCar, LapRef, RecentSession, SessionFile, SkippedFile, TrackOutline,
};

use crate::lap_store::{FileAnalysis, StoredLap};

/// Bumped with every schema step; `migrate` runs the steps above the file's.
const SCHEMA_VERSION: i64 = 8;

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

/// The statistics' own choices; step 4 hands its one row to `settings.json`.
const SCHEMA_V2: &str = "
CREATE TABLE setting (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
";

/// One outline per track, from the first file that held a clean lap of it.
const SCHEMA_V3: &str = "
CREATE TABLE track_outline (
  track_id  INTEGER PRIMARY KEY,
  svg_path  TEXT NOT NULL,
  view_box  TEXT NOT NULL
);
";

/// Settings live in `settings.json`, data here (ADR-0015): the folder row
/// leaves with its table, and `StatsDb::take_legacy_folder` hands it over.
const SCHEMA_V4: &str = "DROP TABLE IF EXISTS setting;";

/// The facts the lap analysis and Home's filters need. A file's stamp of
/// size -1 matches no file on disk, so the next pass reads every file again
/// and fills them in.
const SCHEMA_V5: &str = "
ALTER TABLE session ADD COLUMN has_ai INTEGER NOT NULL DEFAULT 0;
ALTER TABLE session ADD COLUMN track_length_m REAL;
ALTER TABLE run ADD COLUMN best_lap_num INTEGER;
CREATE TABLE track_sectors (
  track_id    INTEGER PRIMARY KEY,
  start_pcts  TEXT NOT NULL
);
UPDATE ibt_file SET size = -1;
";

/// The analysis lap set: laps of one session, kept across restarts. No key
/// to `lap`: a file read again replaces its laps, and the set must outlive it.
const SCHEMA_V6: &str = "
CREATE TABLE analysis_lap (
  position     INTEGER PRIMARY KEY,
  session_key  TEXT NOT NULL,
  path         TEXT NOT NULL,
  session_num  INTEGER NOT NULL,
  lap_num      INTEGER NOT NULL,
  color        TEXT NOT NULL,
  visible      INTEGER NOT NULL DEFAULT 1,
  reference    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (path, session_num, lap_num)
);
";

/// Each timed lap's chart channels and each file's setup, so the analysis
/// outlives the `.ibt`. A lap's row goes with the lap, so a file read again
/// replaces its own. The read files are stamped stale: the next pass reads
/// those still on disk once more and fills the tables.
const SCHEMA_V7: &str = "
CREATE TABLE lap_telemetry (
  path         TEXT NOT NULL,
  session_num  INTEGER NOT NULL,
  lap_num      INTEGER NOT NULL,
  session_key  TEXT NOT NULL,
  points       INTEGER NOT NULL,
  channels     TEXT NOT NULL,
  lap_values   BLOB NOT NULL,
  PRIMARY KEY (path, session_num, lap_num),
  FOREIGN KEY (path, session_num, lap_num)
    REFERENCES lap(path, session_num, lap_num) ON DELETE CASCADE
);
CREATE INDEX lap_telemetry_session ON lap_telemetry(session_key);
CREATE TABLE session_setup (
  path         TEXT PRIMARY KEY REFERENCES ibt_file(path) ON DELETE CASCADE,
  session_key  TEXT NOT NULL,
  setup        TEXT NOT NULL
);
CREATE INDEX session_setup_session ON session_setup(session_key);
UPDATE ibt_file SET size = -1 WHERE status = 'read';
";

/// The files of a deleted session the import never reads again, whatever
/// becomes of them on disk.
const SCHEMA_V8: &str = "
CREATE TABLE ignored_file (
  path  TEXT PRIMARY KEY
);
";

/// Between the sector starts in `track_sectors.start_pcts`.
const SECTOR_SEPARATOR: char = ',';

const LEGACY_SETTING_FOLDER: &str = "folder";

pub(crate) const STATUS_READ: &str = "read";
const STATUS_BROKEN: &str = "broken";
pub(crate) const RACE_RUN_TYPE: &str = "Race";

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
    /// The `.ibt` folder a database before step 4 held, until main takes it.
    legacy_folder: Option<String>,
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
        let legacy_folder = migrate(&connection)?;

        Ok(Self {
            connection,
            legacy_folder,
        })
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
        self.record_read_with(stamp, file, &FileAnalysis::default(), read_at)
    }

    /// `record_read`, with the laps' telemetry and the setup the file held.
    /// A lap of `analysis` the file has no row for is not stored.
    pub fn record_read_with(
        &mut self,
        stamp: &FileStamp,
        file: &SessionFile,
        analysis: &FileAnalysis,
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
        insert_lap_telemetry(&transaction, &stamp.path, &key, &analysis.laps)?;
        replace_setup(&transaction, &stamp.path, &key, analysis.setup.as_ref())?;
        insert_outline(&transaction, file)?;
        insert_sectors(&transaction, file)?;

        transaction.commit().map_err(to_message)
    }

    /// A lap's stored telemetry; `None` when the database holds none.
    pub fn lap_telemetry(&self, lap: &LapRef) -> Result<Option<StoredLap>, String> {
        let row: Option<(u32, String, Vec<u8>)> = self
            .connection
            .query_row(
                "SELECT points, channels, lap_values FROM lap_telemetry
                 WHERE path = ?1 AND session_num = ?2 AND lap_num = ?3",
                params![lap.path, lap.session_num, lap.lap_num],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()
            .map_err(to_message)?;
        let Some((points, channels, packed)) = row else {
            return Ok(None);
        };

        Ok(Some(StoredLap {
            lap: LapKey {
                session_num: lap.session_num,
                lap_num: lap.lap_num,
            },
            points,
            channels: serde_json::from_str(&channels).map_err(|error| error.to_string())?,
            packed,
        }))
    }

    /// The setup a file held when it was read; `None` when none was stored.
    pub fn stored_setup(&self, path: &str) -> Result<Option<CarSetupView>, String> {
        let text: Option<String> = self
            .connection
            .query_row(
                "SELECT setup FROM session_setup WHERE path = ?1",
                params![path],
                |row| row.get(0),
            )
            .optional()
            .map_err(to_message)?;

        text.map(|text| serde_json::from_str(&text).map_err(|error| error.to_string()))
            .transpose()
    }

    /// Where each sector of a track starts, a fraction of the lap; empty
    /// before a file named them.
    pub fn track_sectors(&self, track_id: i64) -> Result<Vec<f64>, String> {
        let text: Option<String> = self
            .connection
            .query_row(
                "SELECT start_pcts FROM track_sectors WHERE track_id = ?1",
                params![track_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(to_message)?;

        Ok(text
            .iter()
            .flat_map(|text| text.split(SECTOR_SEPARATOR))
            .filter_map(|start| start.parse().ok())
            .collect())
    }

    /// The outline a session file drew of the track; `None` before one did.
    pub fn track_outline(&self, track_id: i64) -> Result<Option<TrackOutline>, String> {
        self.connection
            .query_row(
                "SELECT svg_path, view_box FROM track_outline WHERE track_id = ?1",
                params![track_id],
                |row| {
                    Ok(TrackOutline {
                        svg_path: row.get(0)?,
                        view_box: row.get(1)?,
                    })
                },
            )
            .optional()
            .map_err(to_message)
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
        transaction
            .execute(
                "DELETE FROM session_setup WHERE path = ?1",
                params![stamp.path],
            )
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

    /// The files that could not be read, the latest tried first.
    pub fn skipped_files(&self) -> Result<Vec<SkippedFile>, String> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT path, error, read_at FROM ibt_file
                 WHERE status = ?1 ORDER BY read_at DESC, path",
            )
            .map_err(to_message)?;
        let rows = statement
            .query_map(params![STATUS_BROKEN], |row| {
                Ok(SkippedFile {
                    path: row.get(0)?,
                    error: row.get(1)?,
                    read_at: row.get::<_, i64>(2)? as f64,
                })
            })
            .map_err(to_message)?;

        rows.map(|row| row.map_err(to_message)).collect()
    }

    /// Every car of a read session, once, by name; the class as the sim wrote
    /// it, the latest session's.
    pub fn known_cars(&self) -> Result<Vec<KnownCar>, String> {
        let mut statement = self
            .connection
            .prepare(
                // With one MAX() aggregate, SQLite takes the bare columns from
                // the row holding the maximum: the latest session's.
                "SELECT s.car_id, s.car_name, s.car_class, MAX(f.started_at)
                 FROM session s
                 JOIN ibt_file f ON f.session_key = s.key AND f.status = ?1
                 WHERE s.car_id IS NOT NULL
                 GROUP BY s.car_id
                 ORDER BY s.car_name, s.car_id",
            )
            .map_err(to_message)?;
        let rows = statement
            .query_map(params![STATUS_READ], |row| {
                Ok(KnownCar {
                    car_id: row.get(0)?,
                    car_name: row.get(1)?,
                    car_class: row
                        .get::<_, Option<String>>(2)?
                        .map(|name| name.trim().to_string())
                        .filter(|name| !name.is_empty()),
                })
            })
            .map_err(to_message)?;

        rows.map(|row| row.map_err(to_message)).collect()
    }

    /// Forgets the skipped files no longer in the folder read — deleted, or
    /// left behind by a change of folder. A read file is kept: its sessions
    /// outlive it.
    pub fn forget_skipped_except(&mut self, on_disk: &HashSet<String>) -> Result<(), String> {
        let gone: Vec<String> = self
            .skipped_files()?
            .into_iter()
            .map(|file| file.path)
            .filter(|path| !on_disk.contains(path))
            .collect();
        let transaction = self.connection.transaction().map_err(to_message)?;

        for path in gone {
            transaction
                .execute("DELETE FROM ibt_file WHERE path = ?1", params![path])
                .map_err(to_message)?;
        }

        transaction.commit().map_err(to_message)
    }

    /// Drops everything stored of a session, its analysis laps too. Returns
    /// the paths of its files; with `ignore_files` the import never reads
    /// them again.
    pub fn delete_session(&mut self, key: &str, ignore_files: bool) -> Result<Vec<String>, String> {
        let transaction = self.connection.transaction().map_err(to_message)?;
        let paths: Vec<String> = {
            let mut statement = transaction
                .prepare("SELECT path FROM ibt_file WHERE session_key = ?1 ORDER BY path")
                .map_err(to_message)?;
            let rows = statement
                .query_map(params![key], |row| row.get(0))
                .map_err(to_message)?;

            rows.collect::<Result<_, _>>().map_err(to_message)?
        };

        for table in [
            "analysis_lap",
            "lap_telemetry",
            "lap",
            "run",
            "session_setup",
            "ibt_file",
        ] {
            transaction
                .execute(
                    &format!("DELETE FROM {table} WHERE session_key = ?1"),
                    params![key],
                )
                .map_err(to_message)?;
        }

        transaction
            .execute("DELETE FROM session WHERE key = ?1", params![key])
            .map_err(to_message)?;

        if ignore_files {
            insert_ignored(&transaction, &paths)?;
        }

        transaction.commit().map_err(to_message)?;

        Ok(paths)
    }

    /// The import never reads `paths` again.
    pub fn ignore_files(&mut self, paths: &[String]) -> Result<(), String> {
        let transaction = self.connection.transaction().map_err(to_message)?;

        insert_ignored(&transaction, paths)?;

        transaction.commit().map_err(to_message)
    }

    /// The files of deleted sessions the import leaves alone.
    pub fn ignored_files(&self) -> Result<HashSet<String>, String> {
        let mut statement = self
            .connection
            .prepare("SELECT path FROM ignored_file")
            .map_err(to_message)?;
        let rows = statement
            .query_map([], |row| row.get(0))
            .map_err(to_message)?;

        rows.map(|row| row.map_err(to_message)).collect()
    }

    /// The `.ibt` folder the dropped `setting` table held, once: main moves
    /// it into `settings.json`.
    pub fn take_legacy_folder(&mut self) -> Option<String> {
        self.legacy_folder.take()
    }

    pub(crate) fn with_results(&self, session: RecentSession) -> Result<RecentSession, String> {
        let best_lap_s = self.session_best(&session.key)?.map(|best| best.time_s);
        let incidents = self.session_incidents(&session.key)?;
        let (finish_pos, field_size) = self.session_finish(&session.key)?;

        Ok(RecentSession {
            finish_pos,
            field_size,
            best_lap_s,
            incidents,
            ..session
        })
    }

    /// (finish position, field size) of the session's last race, as its
    /// latest file saw the flag; both `None` without a race result. The field
    /// size comes from the latest file whose results list the race: the one
    /// at the flag often opened before the results were out.
    pub(crate) fn session_finish(&self, key: &str) -> Result<(Option<u32>, Option<u32>), String> {
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
                params![key, RACE_RUN_TYPE],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(to_message)?;

        Ok(finish.unwrap_or((None, None)))
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

/// Runs the steps above the file's version. Returns the folder row step 4
/// dropped, if there was one.
fn migrate(connection: &Connection) -> Result<Option<String>, String> {
    let version: i64 = connection
        .pragma_query_value(None, "user_version", |row| row.get(0))
        .map_err(to_message)?;
    let mut legacy_folder = None;

    if version < 1 {
        connection.execute_batch(SCHEMA_V1).map_err(to_message)?;
    }

    if version < 2 {
        connection.execute_batch(SCHEMA_V2).map_err(to_message)?;
    }

    if version < 3 {
        connection.execute_batch(SCHEMA_V3).map_err(to_message)?;
    }

    if version < 4 {
        legacy_folder = connection
            .query_row(
                "SELECT value FROM setting WHERE key = ?1",
                params![LEGACY_SETTING_FOLDER],
                |row| row.get(0),
            )
            .optional()
            .map_err(to_message)?;
        connection.execute_batch(SCHEMA_V4).map_err(to_message)?;
    }

    if version < 5 {
        connection.execute_batch(SCHEMA_V5).map_err(to_message)?;
    }

    if version < 6 {
        connection.execute_batch(SCHEMA_V6).map_err(to_message)?;
    }

    if version < 7 {
        connection.execute_batch(SCHEMA_V7).map_err(to_message)?;
    }

    if version < 8 {
        connection.execute_batch(SCHEMA_V8).map_err(to_message)?;
    }

    connection
        .pragma_update(None, "user_version", SCHEMA_VERSION)
        .map_err(to_message)?;

    Ok(legacy_folder)
}

/// The first file of a session writes its row; later ones leave it, but for
/// the bots (any file that met one) and a track length the row lacks.
fn insert_session(transaction: &Transaction, key: &str, file: &SessionFile) -> Result<(), String> {
    transaction
        .execute(
            "INSERT INTO session (
               key, subsession_id, session_id, series_id, season_id, league_id, event_type,
               category, official, team_racing, track_id, track_name, track_config,
               track_country, car_id, car_name, car_class, user_id, user_name, irating, licence,
               has_ai, track_length_m
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16,
                       ?17, ?18, ?19, ?20, ?21, ?22, ?23)
             ON CONFLICT(key) DO UPDATE SET
               has_ai = MAX(session.has_ai, excluded.has_ai),
               track_length_m = COALESCE(session.track_length_m, excluded.track_length_m)",
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
                file.has_ai,
                file.track_length_m,
            ],
        )
        .map(|_| ())
        .map_err(to_message)
}

fn insert_ignored(transaction: &Transaction, paths: &[String]) -> Result<(), String> {
    for path in paths {
        transaction
            .execute(
                "INSERT OR IGNORE INTO ignored_file (path) VALUES (?1)",
                params![path],
            )
            .map_err(to_message)?;
    }

    Ok(())
}

/// The first outline of a track stays: one clean lap draws it as well as another.
fn insert_outline(transaction: &Transaction, file: &SessionFile) -> Result<(), String> {
    let (Some(track_id), Some(outline)) = (file.track_id, &file.outline) else {
        return Ok(());
    };

    transaction
        .execute(
            "INSERT OR IGNORE INTO track_outline (track_id, svg_path, view_box)
             VALUES (?1, ?2, ?3)",
            params![track_id, outline.svg_path, outline.view_box],
        )
        .map(|_| ())
        .map_err(to_message)
}

/// A track's sectors as its latest file read names them.
fn insert_sectors(transaction: &Transaction, file: &SessionFile) -> Result<(), String> {
    let Some(track_id) = file.track_id.filter(|_| !file.sectors.is_empty()) else {
        return Ok(());
    };
    let start_pcts = file
        .sectors
        .iter()
        .map(f64::to_string)
        .collect::<Vec<_>>()
        .join(&SECTOR_SEPARATOR.to_string());

    transaction
        .execute(
            "INSERT OR REPLACE INTO track_sectors (track_id, start_pcts) VALUES (?1, ?2)",
            params![track_id, start_pcts],
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
                                  incidents, finish_pos, field_size, best_lap_num)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    path,
                    run.session_num,
                    key,
                    run.run_type,
                    run.time_in_car_s,
                    run.incidents,
                    run.finish_pos,
                    run.field_size,
                    run.best_lap_num,
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

/// The stored laps of a file, for the laps its runs hold. Runs the rows of
/// an earlier read went with their laps.
fn insert_lap_telemetry(
    transaction: &Transaction,
    path: &str,
    key: &str,
    laps: &[StoredLap],
) -> Result<(), String> {
    for lap in laps {
        let channels = serde_json::to_string(&lap.channels).map_err(|error| error.to_string())?;

        transaction
            .execute(
                "INSERT OR REPLACE INTO lap_telemetry
                   (path, session_num, lap_num, session_key, points, channels, lap_values)
                 SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
                 WHERE EXISTS (SELECT 1 FROM lap WHERE path = ?1 AND session_num = ?2 AND lap_num = ?3)",
                params![
                    path,
                    lap.lap.session_num,
                    lap.lap.lap_num,
                    key,
                    lap.points,
                    channels,
                    lap.packed,
                ],
            )
            .map_err(to_message)?;
    }

    Ok(())
}

/// The file's setup as this read found it; none clears an earlier one.
fn replace_setup(
    transaction: &Transaction,
    path: &str,
    key: &str,
    setup: Option<&CarSetupView>,
) -> Result<(), String> {
    transaction
        .execute("DELETE FROM session_setup WHERE path = ?1", params![path])
        .map_err(to_message)?;

    let Some(setup) = setup else {
        return Ok(());
    };
    let text = serde_json::to_string(setup).map_err(|error| error.to_string())?;

    transaction
        .execute(
            "INSERT INTO session_setup (path, session_key, setup) VALUES (?1, ?2, ?3)",
            params![path, key, text],
        )
        .map(|_| ())
        .map_err(to_message)
}

pub(crate) fn to_message(error: rusqlite::Error) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use mt_model::app::car_setup::SetupGroup;
    use mt_model::app::lap_telemetry::{FileTelemetry, LapChannel, LapTelemetry};
    use mt_model::app::stats::{SessionFileLap, SessionFileRun, SessionKind};

    use crate::lap_store::{pack_file, unpack_values};

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
                kind: SessionKind::Race,
                has_ai: false,
                laps: 4,
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
    fn known_cars_are_each_car_once_with_its_latest_class() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let older = SessionFile {
            subsession_id: Some(1),
            car_id: Some(156),
            car_class: Some("GT3 Class".into()),
            ..race_file(1_000)
        };
        let newer = SessionFile {
            subsession_id: Some(2),
            car_id: Some(156),
            car_class: Some(" GT3 ".into()),
            ..race_file(2_000)
        };
        let unknown_car = SessionFile {
            subsession_id: Some(3),
            car_id: None,
            ..race_file(3_000)
        };

        db.record_read(&stamp("a.ibt"), &older, 5).unwrap();
        db.record_read(&stamp("b.ibt"), &newer, 5).unwrap();
        db.record_read(&stamp("c.ibt"), &unknown_car, 5).unwrap();

        assert_eq!(
            db.known_cars().unwrap(),
            vec![KnownCar {
                car_id: 156,
                car_name: Some("Mercedes-AMG GT3".into()),
                car_class: Some("GT3".into()),
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

    #[test]
    fn a_skipped_file_is_listed_until_it_reads() {
        let mut db = StatsDb::open_in_memory().unwrap();
        db.record_broken(&stamp("bad.ibt"), "truncated", 5).unwrap();

        let skipped = db.skipped_files().unwrap();
        assert_eq!(skipped.len(), 1);
        assert_eq!(skipped[0].path, "bad.ibt");
        assert_eq!(skipped[0].error.as_deref(), Some("truncated"));

        db.record_read(&stamp("bad.ibt"), &race_file(1_000), 6)
            .unwrap();

        assert!(db.skipped_files().unwrap().is_empty());
    }

    #[test]
    fn a_skipped_file_gone_from_the_folder_is_forgotten_a_read_one_kept() {
        let mut db = StatsDb::open_in_memory().unwrap();
        db.record_broken(&stamp("gone.ibt"), "truncated", 5)
            .unwrap();
        db.record_broken(&stamp("here.ibt"), "truncated", 5)
            .unwrap();
        db.record_read(&stamp("read.ibt"), &race_file(1_000), 5)
            .unwrap();

        db.forget_skipped_except(&HashSet::from(["here.ibt".to_string()]))
            .unwrap();

        let skipped: Vec<String> = db
            .skipped_files()
            .unwrap()
            .into_iter()
            .map(|file| file.path)
            .collect();
        assert_eq!(skipped, vec!["here.ibt"]);
        assert_eq!(db.recent_sessions(10).unwrap().len(), 1);
    }

    #[test]
    fn a_new_database_has_no_legacy_folder_and_no_setting_table() {
        let mut db = StatsDb::open_in_memory().unwrap();

        assert_eq!(db.take_legacy_folder(), None);
        assert!(!has_table(&db.connection, "setting"));
    }

    #[test]
    fn a_version_three_database_hands_its_folder_over_once_and_drops_the_table() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(&format!("{SCHEMA_V1}{SCHEMA_V2}{SCHEMA_V3}"))
            .unwrap();
        connection
            .execute(
                "INSERT INTO setting (key, value) VALUES ('folder', 'E:/ibt')",
                [],
            )
            .unwrap();
        connection.pragma_update(None, "user_version", 3).unwrap();

        let mut db = StatsDb::prepared(connection).unwrap();

        assert_eq!(db.take_legacy_folder().as_deref(), Some("E:/ibt"));
        assert_eq!(db.take_legacy_folder(), None);
        assert!(!has_table(&db.connection, "setting"));
    }

    #[test]
    fn a_version_three_database_without_a_folder_row_hands_nothing() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(&format!("{SCHEMA_V1}{SCHEMA_V2}{SCHEMA_V3}"))
            .unwrap();
        connection.pragma_update(None, "user_version", 3).unwrap();

        let mut db = StatsDb::prepared(connection).unwrap();

        assert_eq!(db.take_legacy_folder(), None);
        assert!(!has_table(&db.connection, "setting"));
    }

    #[test]
    fn a_session_met_bots_when_any_of_its_files_did() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let bots = SessionFile {
            has_ai: true,
            ..race_file(2_000)
        };
        db.record_read(&stamp("a.ibt"), &race_file(1_000), 5)
            .unwrap();
        db.record_read(&stamp("b.ibt"), &bots, 5).unwrap();
        db.record_read(&stamp("c.ibt"), &race_file(3_000), 5)
            .unwrap();

        let has_ai: bool = db
            .connection
            .query_row("SELECT has_ai FROM session", [], |row| row.get(0))
            .unwrap();
        assert!(has_ai);
    }

    #[test]
    fn the_track_length_and_the_runs_best_lap_are_kept() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let mut file = SessionFile {
            track_length_m: Some(4_483.7),
            ..race_file(1_000)
        };
        file.runs = vec![SessionFileRun {
            best_lap_num: Some(2),
            ..race_run(0, vec![lap(1, Some(500.0)), lap(2, Some(490.0))])
        }];
        db.record_read(&stamp("a.ibt"), &file, 5).unwrap();

        let (length, best): (Option<f64>, Option<i64>) = db
            .connection
            .query_row(
                "SELECT s.track_length_m, r.best_lap_num
                 FROM session s JOIN run r ON r.session_key = s.key",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!((length, best), (Some(4_483.7), Some(2)));
    }

    #[test]
    fn a_tracks_sectors_are_the_latest_files() {
        let mut db = StatsDb::open_in_memory().unwrap();
        assert!(db.track_sectors(252).unwrap().is_empty());

        let older = SessionFile {
            sectors: vec![0.0, 0.5],
            ..race_file(1_000)
        };
        let newer = SessionFile {
            sectors: vec![0.0, 0.314079, 0.677624],
            ..race_file(2_000)
        };
        db.record_read(&stamp("a.ibt"), &older, 5).unwrap();
        db.record_read(&stamp("b.ibt"), &newer, 5).unwrap();
        db.record_read(&stamp("c.ibt"), &race_file(3_000), 5)
            .unwrap();

        assert_eq!(
            db.track_sectors(252).unwrap(),
            vec![0.0, 0.314079, 0.677624]
        );
    }

    #[test]
    fn a_version_four_database_reads_every_file_again() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(&format!("{SCHEMA_V1}{SCHEMA_V2}{SCHEMA_V3}{SCHEMA_V4}"))
            .unwrap();
        connection
            .execute(
                "INSERT INTO ibt_file (path, size, modified_at, status, read_at)
                 VALUES ('a.ibt', 100, 1000, 'read', 5)",
                [],
            )
            .unwrap();
        connection.pragma_update(None, "user_version", 4).unwrap();

        let db = StatsDb::prepared(connection).unwrap();
        let pending = crate::scan::pending_files(vec![stamp("a.ibt")], &db.known_files().unwrap());

        assert_eq!(pending, vec![stamp("a.ibt")]);
    }

    fn telemetry_of(session_num: i32, lap_nums: &[i32], speed: f32) -> FileAnalysis {
        let telemetry = FileTelemetry {
            points: 3,
            channels: vec![LapChannel {
                name: "Speed".into(),
                unit: "m/s".into(),
                description: "GPS vehicle speed".into(),
            }],
            laps: lap_nums
                .iter()
                .map(|lap_num| LapTelemetry {
                    lap: LapKey {
                        session_num,
                        lap_num: *lap_num,
                    },
                    values: vec![vec![speed, speed + 1.0, speed + 2.0]],
                })
                .collect(),
        };

        FileAnalysis {
            laps: pack_file(&telemetry).unwrap(),
            setup: None,
        }
    }

    fn lap_ref(path: &str, lap_num: i32) -> LapRef {
        LapRef {
            path: path.into(),
            session_num: 2,
            lap_num,
        }
    }

    fn stored_speed(db: &StatsDb, lap: &LapRef) -> Option<Vec<f32>> {
        db.lap_telemetry(lap)
            .unwrap()
            .map(|stored| unpack_values(&stored).unwrap().remove(0))
    }

    #[test]
    fn a_lap_round_trips_through_the_database() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let mut file = race_file(1_000);
        file.runs = vec![race_run(0, vec![lap(2, Some(490.0))])];

        db.record_read_with(&stamp("a.ibt"), &file, &telemetry_of(2, &[2], 50.0), 5)
            .unwrap();

        let stored = db.lap_telemetry(&lap_ref("a.ibt", 2)).unwrap().unwrap();
        assert_eq!(stored.points, 3);
        assert_eq!(stored.channels[0].unit, "m/s");
        assert_eq!(
            stored_speed(&db, &lap_ref("a.ibt", 2)),
            Some(vec![50.0, 51.0, 52.0])
        );
        assert_eq!(db.lap_telemetry(&lap_ref("a.ibt", 3)).unwrap(), None);
    }

    #[test]
    fn a_file_read_again_replaces_its_stored_laps_and_setup() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let mut file = race_file(1_000);
        file.runs = vec![race_run(0, vec![lap(2, Some(490.0)), lap(3, Some(489.0))])];
        let mut first = telemetry_of(2, &[2, 3], 50.0);
        first.setup = Some(CarSetupView::Setup {
            name: Some("race.sto".into()),
            groups: Vec::new(),
        });
        db.record_read_with(&stamp("a.ibt"), &file, &first, 5)
            .unwrap();

        file.runs = vec![race_run(0, vec![lap(2, Some(490.0))])];
        db.record_read_with(&stamp("a.ibt"), &file, &telemetry_of(2, &[2], 70.0), 6)
            .unwrap();

        assert_eq!(
            stored_speed(&db, &lap_ref("a.ibt", 2)),
            Some(vec![70.0, 71.0, 72.0])
        );
        assert_eq!(db.lap_telemetry(&lap_ref("a.ibt", 3)).unwrap(), None);
        assert_eq!(db.stored_setup("a.ibt").unwrap(), None);
    }

    #[test]
    fn a_files_setup_is_stored_and_a_broken_read_drops_it_with_the_laps() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let mut file = race_file(1_000);
        file.runs = vec![race_run(0, vec![lap(2, Some(490.0))])];
        let setup = CarSetupView::Setup {
            name: Some("race.sto".into()),
            groups: vec![SetupGroup {
                name: "Chassis".into(),
                sections: Vec::new(),
            }],
        };
        let analysis = FileAnalysis {
            setup: Some(setup.clone()),
            ..telemetry_of(2, &[2], 50.0)
        };
        db.record_read_with(&stamp("a.ibt"), &file, &analysis, 5)
            .unwrap();

        assert_eq!(db.stored_setup("a.ibt").unwrap(), Some(setup));

        db.record_broken(&stamp("a.ibt"), "truncated", 6).unwrap();

        assert_eq!(db.stored_setup("a.ibt").unwrap(), None);
        assert_eq!(db.lap_telemetry(&lap_ref("a.ibt", 2)).unwrap(), None);
    }

    #[test]
    fn a_lap_the_file_has_no_row_for_is_not_stored() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let mut file = race_file(1_000);
        file.runs = vec![race_run(0, vec![lap(2, Some(490.0))])];

        db.record_read_with(&stamp("a.ibt"), &file, &telemetry_of(2, &[2, 9], 50.0), 5)
            .unwrap();

        assert_eq!(db.lap_telemetry(&lap_ref("a.ibt", 9)).unwrap(), None);
    }

    #[test]
    fn a_version_six_database_reads_its_read_files_again_not_the_broken_ones() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(&format!(
                "{SCHEMA_V1}{SCHEMA_V2}{SCHEMA_V3}{SCHEMA_V4}{SCHEMA_V5}{SCHEMA_V6}"
            ))
            .unwrap();
        connection
            .execute_batch(
                "INSERT INTO ibt_file (path, size, modified_at, status, read_at)
                 VALUES ('a.ibt', 100, 1000, 'read', 5), ('b.ibt', 100, 1000, 'broken', 5);",
            )
            .unwrap();
        connection.pragma_update(None, "user_version", 6).unwrap();

        let db = StatsDb::prepared(connection).unwrap();
        let pending = crate::scan::pending_files(
            vec![stamp("a.ibt"), stamp("b.ibt")],
            &db.known_files().unwrap(),
        );

        assert_eq!(pending, vec![stamp("a.ibt")]);
        assert!(has_table(&db.connection, "lap_telemetry"));
        assert!(has_table(&db.connection, "session_setup"));
    }

    fn rows_of(db: &StatsDb, table: &str, key: &str) -> i64 {
        let column = if table == "session" {
            "key"
        } else {
            "session_key"
        };

        db.connection
            .query_row(
                &format!("SELECT COUNT(*) FROM {table} WHERE {column} = ?1"),
                params![key],
                |row| row.get(0),
            )
            .unwrap()
    }

    #[test]
    fn a_deleted_session_keeps_nothing_and_leaves_the_others() {
        let mut db = StatsDb::open_in_memory().unwrap();
        let mut deleted = race_file(1_000);
        deleted.runs = vec![race_run(0, vec![lap(2, Some(490.0))])];
        let mut kept = SessionFile {
            subsession_id: Some(88),
            ..deleted.clone()
        };
        kept.started_at = 5_000;
        let analysis = FileAnalysis {
            setup: Some(CarSetupView::Setup {
                name: None,
                groups: Vec::new(),
            }),
            ..telemetry_of(2, &[2], 50.0)
        };
        db.record_read_with(&stamp("a.ibt"), &deleted, &analysis, 5)
            .unwrap();
        db.record_read_with(&stamp("b.ibt"), &deleted, &analysis, 5)
            .unwrap();
        db.record_read_with(&stamp("c.ibt"), &kept, &analysis, 5)
            .unwrap();
        db.add_analysis_laps("sub:77", &[lap_ref("a.ibt", 2)])
            .unwrap();

        let paths = db.delete_session("sub:77", true).unwrap();

        assert_eq!(paths, vec!["a.ibt", "b.ibt"]);

        for table in [
            "session",
            "ibt_file",
            "run",
            "lap",
            "lap_telemetry",
            "session_setup",
            "analysis_lap",
        ] {
            assert_eq!(rows_of(&db, table, "sub:77"), 0, "{table}");
            assert_eq!(
                rows_of(&db, table, "sub:88"),
                i64::from(table != "analysis_lap"),
                "{table}"
            );
        }

        assert_eq!(
            db.ignored_files().unwrap(),
            HashSet::from(["a.ibt".to_string(), "b.ibt".to_string()])
        );
        assert!(!db.known_files().unwrap().contains_key("a.ibt"));
    }

    #[test]
    fn a_session_deleted_with_its_files_ignores_none() {
        let mut db = StatsDb::open_in_memory().unwrap();
        db.record_read(&stamp("a.ibt"), &race_file(1_000), 5)
            .unwrap();

        db.delete_session("sub:77", false).unwrap();

        assert!(db.ignored_files().unwrap().is_empty());
    }

    fn has_table(connection: &Connection, name: &str) -> bool {
        connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                params![name],
                |row| row.get::<_, i64>(0),
            )
            .unwrap()
            > 0
    }
}
