//! A session's laps for the modal, and the analysis lap set: laps of one
//! session, their colours, which are shown and which is the reference.
//!
//! Whether a lap's file is still on disk is the service's to say; rows here
//! leave `file_present` false.

use std::collections::HashSet;

use rusqlite::{params, OptionalExtension};

use mt_model::app::stats::{AnalysisLap, AnalysisSet, LapRef, SessionLap, SessionLaps};

use crate::db::{to_message, StatsDb};

/// The lap colours, in the order they are handed out: no purple, which is
/// the best lap's. After ten the first comes back.
pub const LAP_PALETTE: [&str; 10] = [
    "#4cc9f0", "#f72585", "#ffb703", "#4ade80", "#ff7b54", "#a3e635", "#22d3ee", "#fb7185",
    "#facc15", "#60a5fa",
];

/// A session's best lap.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct SessionBest {
    pub session_num: i64,
    pub lap_num: i64,
    pub time_s: f64,
}

/// One lap row of a session, before deltas.
struct LapRow {
    lap: LapRef,
    run_type: String,
    time_s: Option<f64>,
    incidents: u32,
    in_pit: bool,
    partial: bool,
}

impl StatsDb {
    /// The session's best lap: the fastest of its runs' own best laps (the
    /// sim's rule), else its fastest full lap off pit road.
    pub(crate) fn session_best(&self, key: &str) -> Result<Option<SessionBest>, String> {
        let read_best = |sql: &str| {
            self.connection
                .query_row(sql, params![key], |row| {
                    Ok(SessionBest {
                        session_num: row.get(0)?,
                        lap_num: row.get(1)?,
                        time_s: row.get(2)?,
                    })
                })
                .optional()
                .map_err(to_message)
        };
        let sims_own = read_best(
            "SELECT l.session_num, l.lap_num, l.time_s FROM run r
             JOIN lap l ON l.session_key = r.session_key AND l.session_num = r.session_num
               AND l.lap_num = r.best_lap_num
             WHERE r.session_key = ?1 AND l.time_s IS NOT NULL
             ORDER BY l.time_s, l.session_num, l.lap_num LIMIT 1",
        )?;

        match sims_own {
            Some(best) => Ok(Some(best)),
            None => read_best(
                "SELECT session_num, lap_num, time_s FROM lap
                 WHERE session_key = ?1 AND time_s IS NOT NULL AND in_pit = 0 AND partial = 0
                 ORDER BY time_s, session_num, lap_num LIMIT 1",
            ),
        }
    }

    /// The session's laps, run by run; `None` when the session is not read.
    pub fn session_laps(&self, key: &str) -> Result<Option<SessionLaps>, String> {
        let Some(session) = self.session_row(key)? else {
            return Ok(None);
        };
        let best = self.session_best(key)?;
        let laps = self
            .lap_rows(key)?
            .into_iter()
            .map(|row| {
                let is_best = best.as_ref().is_some_and(|best| is_lap(best, &row.lap));
                let delta_s = row
                    .time_s
                    .filter(|_| !row.in_pit && !row.partial)
                    .zip(best.as_ref())
                    .map(|(time_s, best)| time_s - best.time_s);

                SessionLap {
                    lap: row.lap,
                    run_type: row.run_type,
                    time_s: row.time_s,
                    delta_s,
                    incidents: row.incidents,
                    in_pit: row.in_pit,
                    partial: row.partial,
                    is_best,
                    file_present: false,
                }
            })
            .collect();

        Ok(Some(SessionLaps { session, laps }))
    }

    /// The laps in the analysis in the order added, with their session.
    pub fn analysis_set(&self) -> Result<AnalysisSet, String> {
        let Some(key) = self.analysis_session_key()? else {
            return Ok(AnalysisSet::default());
        };
        let Some(SessionLaps { session, laps }) = self.session_laps(&key)? else {
            return Ok(AnalysisSet::default());
        };
        let mut statement = self
            .connection
            .prepare(
                "SELECT path, session_num, lap_num, color, visible, reference
                 FROM analysis_lap ORDER BY position",
            )
            .map_err(to_message)?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    LapRef {
                        path: row.get(0)?,
                        session_num: row.get(1)?,
                        lap_num: row.get(2)?,
                    },
                    row.get::<_, String>(3)?,
                    row.get::<_, bool>(4)?,
                    row.get::<_, bool>(5)?,
                ))
            })
            .map_err(to_message)?;
        let mut set_laps = Vec::new();

        for row in rows {
            let (lap, color, visible, reference) = row.map_err(to_message)?;
            let session_lap = laps.iter().find(|known| known.lap == lap);

            set_laps.push(AnalysisLap {
                run_type: session_lap
                    .map(|known| known.run_type.clone())
                    .unwrap_or_default(),
                time_s: session_lap.and_then(|known| known.time_s),
                is_best: session_lap.is_some_and(|known| known.is_best),
                lap,
                color,
                visible,
                reference,
                file_present: false,
            });
        }

        let track_id: Option<i64> = self
            .connection
            .query_row(
                "SELECT track_id FROM session WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()
            .map_err(to_message)?
            .flatten();
        let sectors = match track_id {
            Some(track_id) => self.track_sectors(track_id)?,
            None => Vec::new(),
        };

        Ok(AnalysisSet {
            session: Some(session),
            laps: set_laps,
            sectors,
        })
    }

    /// Adds laps of `key`'s session. Laps of another session replace the set;
    /// a lap already in it stays as it is. The first lap of a set is its
    /// reference.
    pub fn add_analysis_laps(&mut self, key: &str, laps: &[LapRef]) -> Result<(), String> {
        let transaction = self.connection.transaction().map_err(to_message)?;
        let current: Option<String> = transaction
            .query_row("SELECT session_key FROM analysis_lap LIMIT 1", [], |row| {
                row.get(0)
            })
            .optional()
            .map_err(to_message)?;

        if current.as_deref().is_some_and(|current| current != key) {
            transaction
                .execute("DELETE FROM analysis_lap", [])
                .map_err(to_message)?;
        }

        for lap in laps {
            let colors: Vec<String> = {
                let mut statement = transaction
                    .prepare("SELECT color FROM analysis_lap ORDER BY position")
                    .map_err(to_message)?;
                let rows = statement
                    .query_map([], |row| row.get(0))
                    .map_err(to_message)?;

                rows.collect::<Result<_, _>>().map_err(to_message)?
            };
            let has_reference: bool = transaction
                .query_row(
                    "SELECT EXISTS (SELECT 1 FROM analysis_lap WHERE reference = 1)",
                    [],
                    |row| row.get(0),
                )
                .map_err(to_message)?;

            transaction
                .execute(
                    "INSERT OR IGNORE INTO analysis_lap
                       (session_key, path, session_num, lap_num, color, visible, reference)
                     VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)",
                    params![
                        key,
                        lap.path,
                        lap.session_num,
                        lap.lap_num,
                        next_color(&colors),
                        !has_reference
                    ],
                )
                .map_err(to_message)?;
        }

        transaction.commit().map_err(to_message)
    }

    /// Takes a lap out; the reference passes to the next lap, else the one
    /// before it.
    pub fn remove_analysis_lap(&mut self, lap: &LapRef) -> Result<(), String> {
        let transaction = self.connection.transaction().map_err(to_message)?;
        let removed: Option<(i64, bool)> = transaction
            .query_row(
                "SELECT position, reference FROM analysis_lap
                 WHERE path = ?1 AND session_num = ?2 AND lap_num = ?3",
                params![lap.path, lap.session_num, lap.lap_num],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(to_message)?;

        if let Some((position, was_reference)) = removed {
            transaction
                .execute(
                    "DELETE FROM analysis_lap WHERE position = ?1",
                    params![position],
                )
                .map_err(to_message)?;

            if was_reference {
                transaction
                    .execute(
                        "UPDATE analysis_lap SET reference = 1 WHERE position = COALESCE(
                           (SELECT MIN(position) FROM analysis_lap WHERE position > ?1),
                           (SELECT MAX(position) FROM analysis_lap))",
                        params![position],
                    )
                    .map_err(to_message)?;
            }
        }

        transaction.commit().map_err(to_message)
    }

    pub fn set_analysis_lap_color(&mut self, lap: &LapRef, color: &str) -> Result<(), String> {
        self.update_analysis_lap(lap, "color = ?4", color)
    }

    pub fn set_analysis_lap_visible(&mut self, lap: &LapRef, visible: bool) -> Result<(), String> {
        self.update_analysis_lap(lap, "visible = ?4", visible)
    }

    /// Makes `lap` the one the delta counts against.
    pub fn set_analysis_reference(&mut self, lap: &LapRef) -> Result<(), String> {
        self.connection
            .execute(
                "UPDATE analysis_lap
                 SET reference = (path = ?1 AND session_num = ?2 AND lap_num = ?3)",
                params![lap.path, lap.session_num, lap.lap_num],
            )
            .map(|_| ())
            .map_err(to_message)
    }

    fn update_analysis_lap(
        &mut self,
        lap: &LapRef,
        assignment: &str,
        value: impl rusqlite::ToSql,
    ) -> Result<(), String> {
        self.connection
            .execute(
                &format!(
                    "UPDATE analysis_lap SET {assignment}
                     WHERE path = ?1 AND session_num = ?2 AND lap_num = ?3"
                ),
                params![lap.path, lap.session_num, lap.lap_num, value],
            )
            .map(|_| ())
            .map_err(to_message)
    }

    fn analysis_session_key(&self) -> Result<Option<String>, String> {
        self.connection
            .query_row("SELECT session_key FROM analysis_lap LIMIT 1", [], |row| {
                row.get(0)
            })
            .optional()
            .map_err(to_message)
    }

    /// The session's laps run by run, a lap once whichever files hold it —
    /// the one with a time, else the first file's.
    fn lap_rows(&self, key: &str) -> Result<Vec<LapRow>, String> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT l.path, l.session_num, l.lap_num, r.run_type, l.time_s, l.incidents,
                        l.in_pit, l.partial
                 FROM lap l
                 JOIN run r ON r.path = l.path AND r.session_num = l.session_num
                 JOIN ibt_file f ON f.path = l.path
                 WHERE l.session_key = ?1
                 ORDER BY l.session_num, l.lap_num, l.time_s IS NULL, f.started_at",
            )
            .map_err(to_message)?;
        let rows = statement
            .query_map(params![key], |row| {
                Ok(LapRow {
                    lap: LapRef {
                        path: row.get(0)?,
                        session_num: row.get(1)?,
                        lap_num: row.get(2)?,
                    },
                    run_type: row.get(3)?,
                    time_s: row.get(4)?,
                    incidents: row.get(5)?,
                    in_pit: row.get(6)?,
                    partial: row.get(7)?,
                })
            })
            .map_err(to_message)?;
        let mut seen = HashSet::new();
        let mut laps = Vec::new();

        for row in rows {
            let row = row.map_err(to_message)?;

            if seen.insert((row.lap.session_num, row.lap.lap_num)) {
                laps.push(row);
            }
        }

        Ok(laps)
    }
}

fn is_lap(best: &SessionBest, lap: &LapRef) -> bool {
    best.session_num == i64::from(lap.session_num) && best.lap_num == i64::from(lap.lap_num)
}

/// The first palette colour no lap of the set wears; with all ten worn, the
/// palette goes round again.
fn next_color(worn: &[String]) -> &'static str {
    LAP_PALETTE
        .iter()
        .find(|color| !worn.iter().any(|worn| worn == *color))
        .copied()
        .unwrap_or(LAP_PALETTE[worn.len() % LAP_PALETTE.len()])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::FileStamp;
    use mt_model::app::stats::{SessionFile, SessionFileLap, SessionFileRun};

    fn lap(lap_num: i64, time_s: f64) -> SessionFileLap {
        SessionFileLap {
            lap_num,
            time_s: Some(time_s),
            ..SessionFileLap::default()
        }
    }

    fn session(id: i64, best_lap_num: Option<i64>, laps: Vec<SessionFileLap>) -> SessionFile {
        SessionFile {
            started_at: id * 1_000,
            ended_at: id * 1_000 + 600,
            subsession_id: Some(id),
            event_type: "Race".into(),
            track_id: Some(252),
            sectors: vec![0.0, 0.5],
            runs: vec![SessionFileRun {
                session_num: 2,
                run_type: "Race".into(),
                best_lap_num,
                laps,
                ..SessionFileRun::default()
            }],
            ..SessionFile::default()
        }
    }

    fn db_with(files: &[SessionFile]) -> StatsDb {
        let mut db = StatsDb::open_in_memory().unwrap();

        for file in files {
            let stamp = FileStamp {
                path: format!("{}.ibt", file.subsession_id.unwrap()),
                size: 1,
                modified_at: 1,
            };
            db.record_read(&stamp, file, 1).unwrap();
        }

        db
    }

    fn lap_ref(id: i64, lap_num: i32) -> LapRef {
        LapRef {
            path: format!("{id}.ibt"),
            session_num: 2,
            lap_num,
        }
    }

    fn race() -> Vec<SessionFileLap> {
        vec![
            SessionFileLap {
                partial: true,
                ..lap(1, 90.0)
            },
            SessionFileLap {
                incidents: 1,
                ..lap(2, 99.0)
            },
            lap(3, 100.5),
            SessionFileLap {
                in_pit: true,
                ..lap(4, 130.0)
            },
        ]
    }

    #[test]
    fn the_sims_best_is_the_best_lap_and_the_deltas_count_from_it() {
        let db = db_with(&[session(1, Some(3), race())]);

        let laps = db.session_laps("sub:1").unwrap().unwrap().laps;
        let seen: Vec<(i32, bool, Option<f64>)> = laps
            .iter()
            .map(|lap| (lap.lap.lap_num, lap.is_best, lap.delta_s))
            .collect();

        assert_eq!(
            seen,
            vec![
                (1, false, None),
                (2, false, Some(-1.5)),
                (3, true, Some(0.0)),
                (4, false, None),
            ]
        );
        assert_eq!(
            db.session_row("sub:1").unwrap().unwrap().best_lap_s,
            Some(100.5)
        );
    }

    #[test]
    fn without_the_sims_best_the_fastest_full_lap_off_pit_road_is() {
        let db = db_with(&[session(1, None, race())]);

        let laps = db.session_laps("sub:1").unwrap().unwrap().laps;

        assert_eq!(
            laps.iter()
                .find(|lap| lap.is_best)
                .map(|lap| lap.lap.lap_num),
            Some(2)
        );
    }

    #[test]
    fn the_first_lap_added_is_the_reference_and_laps_take_palette_colours() {
        let mut db = db_with(&[session(1, Some(3), race())]);

        db.add_analysis_laps("sub:1", &[lap_ref(1, 3), lap_ref(1, 2)])
            .unwrap();
        db.add_analysis_laps("sub:1", &[lap_ref(1, 3)]).unwrap();

        let set = db.analysis_set().unwrap();
        let laps: Vec<(i32, &str, bool)> = set
            .laps
            .iter()
            .map(|lap| (lap.lap.lap_num, lap.color.as_str(), lap.reference))
            .collect();

        assert_eq!(set.session.unwrap().key, "sub:1");
        assert_eq!(set.sectors, vec![0.0, 0.5]);
        assert_eq!(
            laps,
            vec![(3, LAP_PALETTE[0], true), (2, LAP_PALETTE[1], false)]
        );
        assert!(set.laps[0].is_best);
    }

    #[test]
    fn laps_of_another_session_replace_the_set() {
        let mut db = db_with(&[session(1, Some(3), race()), session(2, Some(3), race())]);
        db.add_analysis_laps("sub:1", &[lap_ref(1, 2), lap_ref(1, 3)])
            .unwrap();

        db.add_analysis_laps("sub:2", &[lap_ref(2, 3)]).unwrap();

        let set = db.analysis_set().unwrap();
        assert_eq!(set.session.unwrap().key, "sub:2");
        assert_eq!(set.laps.len(), 1);
        assert!(set.laps[0].reference);
        assert_eq!(set.laps[0].color, LAP_PALETTE[0]);
    }

    #[test]
    fn the_reference_moves_to_the_next_lap_when_removed_else_the_one_before() {
        let mut db = db_with(&[session(1, Some(3), race())]);
        db.add_analysis_laps("sub:1", &[lap_ref(1, 2), lap_ref(1, 3), lap_ref(1, 4)])
            .unwrap();
        let reference = |db: &StatsDb| {
            db.analysis_set()
                .unwrap()
                .laps
                .iter()
                .find(|lap| lap.reference)
                .map(|lap| lap.lap.lap_num)
        };

        db.remove_analysis_lap(&lap_ref(1, 2)).unwrap();
        assert_eq!(reference(&db), Some(3));

        db.set_analysis_reference(&lap_ref(1, 4)).unwrap();
        db.remove_analysis_lap(&lap_ref(1, 4)).unwrap();
        assert_eq!(reference(&db), Some(3));

        db.remove_analysis_lap(&lap_ref(1, 3)).unwrap();
        assert_eq!(db.analysis_set().unwrap(), AnalysisSet::default());
    }

    #[test]
    fn a_colour_freed_by_a_removal_is_handed_out_first_and_eleven_laps_repeat() {
        let worn: Vec<String> = LAP_PALETTE.iter().map(|color| (*color).into()).collect();

        assert_eq!(next_color(&worn[1..]), LAP_PALETTE[0]);
        assert_eq!(next_color(&worn), LAP_PALETTE[0]);
        assert!(LAP_PALETTE
            .iter()
            .all(|color| !["#b366ff", "#a855f7"].contains(color)));
    }

    #[test]
    fn colour_and_visibility_are_kept() {
        let mut db = db_with(&[session(1, Some(3), race())]);
        db.add_analysis_laps("sub:1", &[lap_ref(1, 3)]).unwrap();

        db.set_analysis_lap_color(&lap_ref(1, 3), "#123456")
            .unwrap();
        db.set_analysis_lap_visible(&lap_ref(1, 3), false).unwrap();

        let lap = &db.analysis_set().unwrap().laps[0];
        assert_eq!((lap.color.as_str(), lap.visible), ("#123456", false));
    }
}
