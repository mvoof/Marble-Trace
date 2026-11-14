//! The stats import: from app start, the session files not yet read become
//! session records, one file at a time on a thread of its own, paused while
//! the sim is connected — the sim writes those files and wants the disk.
//!
//! After a pass it waits for the sim to come and go, then looks again for the
//! files that session wrote.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use mt_model::app::stats::{RecentSession, SessionFile, StatsImportPhase, StatsImportStatus};
use mt_model::contract::event_sink::EventSink;
use mt_model::contract::events::EVENT_STATS_IMPORT;
use mt_model::utils::lock_or_recover;

use crate::db::{FileStamp, StatsDb};
use crate::scan::{list_session_files, pending_files};

/// How often a waiting import looks at the sim's connection.
const CONNECTION_POLL: Duration = Duration::from_secs(3);
const THREAD_NAME: &str = "stats-import";

/// Reads one session file; the sim's adapter provides it.
pub type SessionFileReader = fn(&Path) -> Result<SessionFile, String>;

/// What the import needs from the app.
pub struct StatsHost {
    pub sink: Arc<dyn EventSink>,
    /// The sim's session file folder; `None` when it could not be resolved.
    pub folder: Option<PathBuf>,
    pub read_file: SessionFileReader,
    pub is_connected: Box<dyn Fn() -> bool + Send + Sync>,
    /// How long to wait between two looks at the connection.
    pub poll: Duration,
}

impl StatsHost {
    pub fn new(
        sink: Arc<dyn EventSink>,
        folder: Option<PathBuf>,
        read_file: SessionFileReader,
        is_connected: Box<dyn Fn() -> bool + Send + Sync>,
    ) -> Self {
        Self {
            sink,
            folder,
            read_file,
            is_connected,
            poll: CONNECTION_POLL,
        }
    }
}

/// The database and the import's progress, shared with the commands.
pub struct StatsService {
    db: Mutex<StatsDb>,
    status: Mutex<StatsImportStatus>,
}

impl StatsService {
    pub fn new(db: StatsDb) -> Self {
        let broken = db.broken_count().unwrap_or_default();

        Self {
            db: Mutex::new(db),
            status: Mutex::new(StatsImportStatus {
                broken,
                ..StatsImportStatus::default()
            }),
        }
    }

    pub fn status(&self) -> StatsImportStatus {
        *lock_or_recover(&self.status)
    }

    pub fn recent_sessions(&self, limit: u32) -> Result<Vec<RecentSession>, String> {
        lock_or_recover(&self.db).recent_sessions(limit)
    }

    fn publish(&self, host: &StatsHost, status: StatsImportStatus) {
        *lock_or_recover(&self.status) = status;

        if let Err(error) = host.sink.emit(EVENT_STATS_IMPORT, &status) {
            tracing::warn!(%error, "stats import status not sent");
        }
    }
}

/// Starts the import thread.
pub fn start(service: Arc<StatsService>, host: StatsHost) {
    let spawned = thread::Builder::new()
        .name(THREAD_NAME.into())
        .spawn(move || run(&service, &host));

    if let Err(error) = spawned {
        tracing::error!(%error, "stats import thread not started");
    }
}

fn run(service: &StatsService, host: &StatsHost) {
    loop {
        let met_the_sim = run_pass(service, host);

        // A session driven during the pass wrote files the pass did not list.
        if !met_the_sim {
            wait_for_a_session(host);
        }
    }
}

/// Reads every pending file once. Returns whether the sim connected meanwhile.
pub fn run_pass(service: &StatsService, host: &StatsHost) -> bool {
    let Some(folder) = host.folder.as_deref().filter(|folder| folder.is_dir()) else {
        service.publish(host, phase_only(service, StatsImportPhase::NoFolder));

        return false;
    };

    let pending = match list_session_files(folder) {
        Ok(on_disk) => {
            let known = lock_or_recover(&service.db)
                .known_files()
                .unwrap_or_default();

            pending_files(on_disk, &known)
        }
        Err(error) => {
            tracing::warn!(%error, folder = %folder.display(), "session file folder not listed");
            Vec::new()
        }
    };

    let total = u32::try_from(pending.len()).unwrap_or(u32::MAX);
    let mut status = StatsImportStatus {
        phase: StatsImportPhase::Reading,
        done: 0,
        total,
        broken: service.status().broken,
    };
    let mut met_the_sim = false;

    if total > 0 {
        tracing::info!(total, "stats import: reading session files");
    }

    for stamp in pending {
        if (host.is_connected)() {
            met_the_sim = true;
            service.publish(
                host,
                StatsImportStatus {
                    phase: StatsImportPhase::Paused,
                    ..status
                },
            );
            wait_while_connected(host);
        }

        service.publish(host, status);
        status.broken = import_one(service, host, &stamp);
        status.done += 1;
    }

    service.publish(
        host,
        StatsImportStatus {
            phase: StatsImportPhase::Idle,
            ..status
        },
    );

    met_the_sim
}

/// Reads one file into the database. Returns the broken files count after it.
fn import_one(service: &StatsService, host: &StatsHost, stamp: &FileStamp) -> u32 {
    // Read outside the lock: a long file must not hold up the commands.
    let read = (host.read_file)(Path::new(&stamp.path));
    let mut db = lock_or_recover(&service.db);
    let stored = match read {
        Ok(file) => db.record_read(stamp, &file, now()),
        Err(error) => {
            tracing::warn!(%error, path = %stamp.path, "session file skipped");
            db.record_broken(stamp, &error, now())
        }
    };

    if let Err(error) = stored {
        tracing::error!(%error, path = %stamp.path, "session file not stored");
    }

    db.broken_count().unwrap_or_default()
}

fn phase_only(service: &StatsService, phase: StatsImportPhase) -> StatsImportStatus {
    StatsImportStatus {
        phase,
        done: 0,
        total: 0,
        broken: service.status().broken,
    }
}

fn wait_while_connected(host: &StatsHost) {
    while (host.is_connected)() {
        thread::sleep(host.poll);
    }
}

/// Until the sim has connected and gone again.
fn wait_for_a_session(host: &StatsHost) {
    while !(host.is_connected)() {
        thread::sleep(host.poll);
    }

    wait_while_connected(host);
}

fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|elapsed| i64::try_from(elapsed.as_secs()).ok())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[derive(Default)]
    struct RecordingSink {
        statuses: Mutex<Vec<String>>,
    }

    impl EventSink for RecordingSink {
        fn emit_json(&self, _event: &str, payload: String) -> Result<(), String> {
            self.statuses.lock().unwrap().push(payload);
            Ok(())
        }

        fn emit_json_to(&self, _label: &str, _event: &str, _payload: String) -> Result<(), String> {
            Ok(())
        }
    }

    fn fake_reader(path: &Path) -> Result<SessionFile, String> {
        let name = path.file_stem().unwrap().to_string_lossy().into_owned();

        if name == "broken" {
            return Err("truncated".into());
        }

        Ok(SessionFile {
            started_at: name.len() as i64,
            subsession_id: Some(name.len() as i64),
            event_type: "Practice".into(),
            ..SessionFile::default()
        })
    }

    fn folder_with(names: &[&str]) -> PathBuf {
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let folder = std::env::temp_dir().join(format!(
            "mt-stats-test-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&folder).unwrap();

        for name in names {
            fs::write(folder.join(name), b"x").unwrap();
        }

        folder
    }

    fn host(sink: Arc<RecordingSink>, folder: Option<PathBuf>) -> StatsHost {
        StatsHost::new(sink, folder, fake_reader, Box::new(|| false))
    }

    #[test]
    fn a_pass_reads_new_files_skips_broken_ones_and_reads_nothing_twice() {
        let folder = folder_with(&["a.ibt", "bb.ibt", "broken.ibt", "notes.txt"]);
        let sink = Arc::new(RecordingSink::default());
        let host = host(Arc::clone(&sink), Some(folder.clone()));
        let service = StatsService::new(StatsDb::open_in_memory().unwrap());

        run_pass(&service, &host);

        assert_eq!(
            service.status(),
            StatsImportStatus {
                phase: StatsImportPhase::Idle,
                done: 3,
                total: 3,
                broken: 1,
            }
        );
        assert_eq!(service.recent_sessions(10).unwrap().len(), 2);

        run_pass(&service, &host);

        assert_eq!(service.status().total, 0);
        assert_eq!(
            sink.statuses.lock().unwrap().last().unwrap(),
            r#"{"phase":"idle","done":0,"total":0,"broken":1}"#
        );

        fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn a_missing_folder_is_reported() {
        let sink = Arc::new(RecordingSink::default());
        let service = StatsService::new(StatsDb::open_in_memory().unwrap());

        run_pass(
            &service,
            &host(sink, Some(PathBuf::from("Z:/no/such/folder"))),
        );

        assert_eq!(service.status().phase, StatsImportPhase::NoFolder);
    }
}
