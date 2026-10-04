//! The telemetry loop's slow work, off the loop: session-YAML parsing and every
//! file the loop used to read or write between two frames.
//!
//! One worker per connection, fed in order. A single queue rather than one per
//! kind of job because the jobs depend on each other: a pit lane patch rewrites
//! the file a shape save just wrote, and must find it there.
//!
//! The reads a session needs travel back **with** the parsed session, so the
//! telemetry thread applies both on the same tick. A cached track shape that
//! arrived a tick after its session would come too late: the track shape
//! processor decides on the first tick of a new track whether to record it.
use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver, Sender};

use tracing::{error, warn};

use super::storage;
use crate::model::reference_lap::{ReferenceLapData, StoredReferenceTimes};
use crate::model::track_shape::TrackShapePayload;
use crate::sources::source::{ParsedSession, SessionParser};

/// Re-publishes a track shape the worker changed on disk.
pub type TrackShapeSink = Box<dyn Fn(&TrackShapePayload) + Send>;

/// Snippet of an unparseable session logged with the warning.
const YAML_SNIPPET_CHARS: usize = 100;

/// A parsed session and what the disk holds for it.
pub struct SessionUpdate {
    pub parsed: ParsedSession,
    /// The shape recorded for this track on an earlier visit. Read only when
    /// the track differs from the previous session's, as a new track is the
    /// only time the processor needs to hear of it.
    pub cached_track: Option<TrackShapePayload>,
    pub stored_reference_times: StoredReferenceTimes,
}

enum IoJob {
    ParseSession(String),
    SaveTrackShape(TrackShapePayload),
    SaveReferenceLap(Box<ReferenceLapData>),
    PatchPitLanePct {
        track_id: i32,
        pit_in_pct: f32,
        pit_exit_pct: f32,
    },
}

/// The telemetry thread's handle on its worker. Dropping it lets the worker
/// finish what is queued and exit — a lap saved on the tick the sim closed is
/// still written.
pub struct IoWorker {
    jobs: Sender<IoJob>,
    sessions: Receiver<SessionUpdate>,
}

impl IoWorker {
    pub fn spawn(
        data_dir: Option<PathBuf>,
        parser: SessionParser,
        on_track_shape: TrackShapeSink,
    ) -> Self {
        let (jobs, job_queue) = mpsc::channel();
        let (session_results, sessions) = mpsc::channel();

        let mut worker = Worker {
            data_dir,
            parser,
            on_track_shape,
            session_results,
            last_track_id: None,
        };

        let spawned = std::thread::Builder::new()
            .name("telemetry-io".into())
            .spawn(move || {
                for job in job_queue {
                    worker.run(job);
                }
            });

        // Without the thread every job is dropped: the stream keeps running,
        // but no session ever arrives and nothing is saved.
        if let Err(spawn_error) = spawned {
            error!("Failed to spawn telemetry I/O worker: {spawn_error}");
        }

        Self { jobs, sessions }
    }

    pub fn parse_session(&self, yaml: String) {
        self.send(IoJob::ParseSession(yaml));
    }

    pub fn save_track_shape(&self, payload: TrackShapePayload) {
        self.send(IoJob::SaveTrackShape(payload));
    }

    pub fn save_reference_lap(&self, data: ReferenceLapData) {
        self.send(IoJob::SaveReferenceLap(Box::new(data)));
    }

    pub fn patch_pit_lane_pct(&self, track_id: i32, pit_in_pct: f32, pit_exit_pct: f32) {
        self.send(IoJob::PatchPitLanePct {
            track_id,
            pit_in_pct,
            pit_exit_pct,
        });
    }

    /// Sessions parsed since the last call, oldest first. Never blocks.
    pub fn parsed_sessions(&self) -> impl Iterator<Item = SessionUpdate> + '_ {
        self.sessions.try_iter()
    }

    fn send(&self, job: IoJob) {
        // Fails only when the worker never started, which was logged then.
        let _ = self.jobs.send(job);
    }
}

struct Worker {
    data_dir: Option<PathBuf>,
    parser: SessionParser,
    on_track_shape: TrackShapeSink,
    session_results: Sender<SessionUpdate>,
    /// Track of the last session parsed on this connection — the one the
    /// telemetry thread will have applied by the time this result reaches it,
    /// since both sides take the sessions in the same order.
    last_track_id: Option<i32>,
}

impl Worker {
    fn run(&mut self, job: IoJob) {
        match job {
            IoJob::ParseSession(yaml) => {
                if let Some(update) = self.prepare_session(&yaml) {
                    // The telemetry thread has moved on to another connection;
                    // this session belonged to the old one.
                    let _ = self.session_results.send(update);
                }
            }
            IoJob::SaveTrackShape(payload) => {
                if let Some(data_dir) = &self.data_dir {
                    storage::save_track_shape(data_dir, &payload);
                }
            }
            IoJob::SaveReferenceLap(data) => {
                if let Some(data_dir) = &self.data_dir {
                    storage::save_reference_lap(data_dir, &data);
                }
            }
            IoJob::PatchPitLanePct {
                track_id,
                pit_in_pct,
                pit_exit_pct,
            } => {
                let Some(data_dir) = &self.data_dir else {
                    warn!("No app data dir; pit lane calibration not saved");
                    return;
                };

                if let Some(patched) =
                    storage::patch_pit_lane_pct(data_dir, track_id, pit_in_pct, pit_exit_pct)
                {
                    (self.on_track_shape)(&patched);
                }
            }
        }
    }

    fn prepare_session(&mut self, yaml: &str) -> Option<SessionUpdate> {
        let Some(parsed) = (self.parser)(yaml) else {
            let snippet: String = yaml.chars().take(YAML_SNIPPET_CHARS).collect();
            warn!("Session YAML parse error. YAML snippet: {snippet}");

            return None;
        };

        let track_id = parsed.snapshot.track_id;
        let track_changed = self.last_track_id != Some(track_id);
        self.last_track_id = Some(track_id);

        let Some(data_dir) = &self.data_dir else {
            return Some(SessionUpdate {
                parsed,
                cached_track: None,
                stored_reference_times: StoredReferenceTimes::default(),
            });
        };

        let cached_track = if track_changed {
            storage::load_cached_track_shape(data_dir, track_id)
        } else {
            None
        };

        let stored_reference_times =
            storage::read_stored_reference_times(data_dir, &parsed.snapshot);

        Some(SessionUpdate {
            parsed,
            cached_track,
            stored_reference_times,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sources::iracing::session_parse::parse_session;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    const RESULT_TIMEOUT: Duration = Duration::from_secs(5);

    fn session_yaml(track_id: i32) -> String {
        format!("WeekendInfo:\n TrackID: {track_id}\n TrackDisplayName: Test Ring\n")
    }

    fn temp_data_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("marble-trace-io-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);

        dir
    }

    fn shape(track_id: i32) -> TrackShapePayload {
        TrackShapePayload {
            track_id,
            svg_path: String::new(),
            view_box: String::new(),
            points: Vec::new(),
            pit_in_pct: None,
            pit_exit_pct: None,
        }
    }

    fn next_session(worker: &IoWorker) -> SessionUpdate {
        worker
            .sessions
            .recv_timeout(RESULT_TIMEOUT)
            .expect("the worker answers")
    }

    fn quiet_worker(data_dir: &std::path::Path) -> IoWorker {
        IoWorker::spawn(
            Some(data_dir.to_path_buf()),
            parse_session,
            Box::new(|_| {}),
        )
    }

    #[test]
    fn a_session_arrives_with_the_shape_recorded_for_its_track() {
        let data_dir = temp_data_dir("cached");
        storage::save_track_shape(&data_dir, &shape(42));

        let worker = quiet_worker(&data_dir);
        worker.parse_session(session_yaml(42));
        let update = next_session(&worker);

        std::fs::remove_dir_all(&data_dir).ok();

        assert_eq!(update.parsed.snapshot.track_id, 42);
        assert_eq!(update.cached_track.map(|track| track.track_id), Some(42));
    }

    #[test]
    fn the_shape_comes_only_with_the_first_session_on_a_track() {
        let data_dir = temp_data_dir("once");
        storage::save_track_shape(&data_dir, &shape(42));
        storage::save_track_shape(&data_dir, &shape(7));

        let worker = quiet_worker(&data_dir);

        for track_id in [42, 42, 7] {
            worker.parse_session(session_yaml(track_id));
        }

        let loaded: Vec<Option<i32>> = (0..3)
            .map(|_| {
                next_session(&worker)
                    .cached_track
                    .map(|track| track.track_id)
            })
            .collect();

        std::fs::remove_dir_all(&data_dir).ok();

        assert_eq!(loaded, vec![Some(42), None, Some(7)]);
    }

    #[test]
    fn an_unparseable_session_is_dropped_and_the_next_still_arrives() {
        let data_dir = temp_data_dir("unparseable");
        let worker = quiet_worker(&data_dir);

        worker.parse_session(":\n  - [unbalanced".into());
        worker.parse_session(session_yaml(42));
        let update = next_session(&worker);

        assert_eq!(update.parsed.snapshot.track_id, 42);
        assert!(worker.sessions.try_recv().is_err());
    }

    // The patch reads the file the save writes; queued back to back they must
    // run in that order, or the calibration is lost on a freshly recorded track.
    #[test]
    fn a_pit_lane_patch_lands_on_the_shape_saved_before_it() {
        let data_dir = temp_data_dir("patch");
        let republished = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&republished);
        let worker = IoWorker::spawn(
            Some(data_dir.clone()),
            parse_session,
            Box::new(move |payload: &TrackShapePayload| {
                sink.lock().unwrap().push(payload.pit_in_pct);
            }),
        );

        worker.save_track_shape(shape(42));
        worker.patch_pit_lane_pct(42, 0.9, 0.1);
        // A session queued after both is answered only once they are done.
        worker.parse_session(session_yaml(42));
        let update = next_session(&worker);

        std::fs::remove_dir_all(&data_dir).ok();

        assert_eq!(*republished.lock().unwrap(), vec![Some(0.9)]);
        assert_eq!(
            update.cached_track.and_then(|track| track.pit_exit_pct),
            Some(0.1)
        );
    }
}
