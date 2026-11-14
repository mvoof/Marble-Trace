//! The stats import: from app start, the session files not yet read become
//! session records, one file at a time on a thread of its own, paused while
//! the sim is connected — the sim writes those files and wants the disk.
//!
//! After a pass it waits for the sim to come and go, then looks again for the
//! files that session wrote — or sooner, when the main window changes the
//! folder or asks to read every file again.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use mt_model::app::stats::{
    HomeStats, RecentSession, SessionFile, SkippedFile, StatsFolder, StatsImportPhase,
    StatsImportStatus,
};
use mt_model::contract::event_sink::EventSink;
use mt_model::contract::events::EVENT_STATS_IMPORT;
use mt_model::utils::lock_or_recover;

use crate::db::{FileStamp, StatsDb};
use crate::scan::{list_session_files, pending_files};

/// How often a waiting import looks at the sim's connection.
const CONNECTION_POLL: Duration = Duration::from_secs(3);
const THREAD_NAME: &str = "stats-import";
const UTF8_BOM: [u8; 3] = [0xEF, 0xBB, 0xBF];

/// Reads one session file; the sim's adapter provides it.
pub type SessionFileReader = fn(&Path) -> Result<SessionFile, String>;

/// What the import needs from the app.
pub struct StatsHost {
    pub sink: Arc<dyn EventSink>,
    pub read_file: SessionFileReader,
    pub is_connected: Box<dyn Fn() -> bool + Send + Sync>,
    /// How long to wait between two looks at the connection.
    pub poll: Duration,
}

impl StatsHost {
    pub fn new(
        sink: Arc<dyn EventSink>,
        read_file: SessionFileReader,
        is_connected: Box<dyn Fn() -> bool + Send + Sync>,
    ) -> Self {
        Self {
            sink,
            read_file,
            is_connected,
            poll: CONNECTION_POLL,
        }
    }
}

/// Which files a pass reads.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PassScope {
    /// Those never seen or changed since.
    Unread,
    /// Every file in the folder again, the skipped ones too.
    All,
}

/// The database and the import's progress, shared with the commands.
pub struct StatsService {
    db: Mutex<StatsDb>,
    status: Mutex<StatsImportStatus>,
    /// The sim's own session file folder; `None` when it was not found.
    default_folder: Option<PathBuf>,
    /// A pass the main window asked for, run once the current one ends.
    requested: Mutex<Option<PassScope>>,
    request_made: Condvar,
}

impl StatsService {
    pub fn new(db: StatsDb, default_folder: Option<PathBuf>) -> Self {
        let broken = db.broken_count().unwrap_or_default();

        Self {
            db: Mutex::new(db),
            status: Mutex::new(StatsImportStatus {
                broken,
                ..StatsImportStatus::default()
            }),
            default_folder,
            requested: Mutex::new(None),
            request_made: Condvar::new(),
        }
    }

    pub fn status(&self) -> StatsImportStatus {
        *lock_or_recover(&self.status)
    }

    /// The folder the driver chose, else the sim's own.
    pub fn folder(&self) -> StatsFolder {
        let chosen = lock_or_recover(&self.db)
            .folder_override()
            .unwrap_or_else(|error| {
                tracing::warn!(%error, "stats folder choice not read");
                None
            });

        match chosen {
            Some(path) => StatsFolder {
                path: Some(path),
                is_default: false,
            },
            None => StatsFolder {
                path: self
                    .default_folder
                    .as_ref()
                    .map(|folder| folder.to_string_lossy().into_owned()),
                is_default: true,
            },
        }
    }

    /// Reads from `folder` from now on; `None` goes back to the sim's own.
    /// The next pass looks at the new folder.
    pub fn set_folder(&self, folder: Option<&str>) -> Result<StatsFolder, String> {
        if let Some(folder) = folder {
            if !Path::new(folder).is_dir() {
                return Err(format!("Not a folder: {folder}"));
            }
        }

        lock_or_recover(&self.db).set_folder_override(folder)?;
        self.request_pass(PassScope::Unread);

        Ok(self.folder())
    }

    /// Asks for a pass; `All` wins over `Unread` while both wait.
    pub fn request_pass(&self, scope: PassScope) {
        let mut requested = lock_or_recover(&self.requested);

        if *requested != Some(PassScope::All) {
            *requested = Some(scope);
        }

        self.request_made.notify_all();
    }

    pub fn skipped_files(&self) -> Result<Vec<SkippedFile>, String> {
        lock_or_recover(&self.db).skipped_files()
    }

    /// Writes every session record to `path` as CSV. Returns how many.
    pub fn export_sessions_csv(&self, path: &Path) -> Result<u32, String> {
        let (text, count) = lock_or_recover(&self.db).sessions_csv()?;
        // Excel reads a file without the mark in the system's code page.
        let bytes = [UTF8_BOM.as_slice(), text.as_bytes()].concat();

        std::fs::write(path, bytes).map_err(|error| error.to_string())?;

        Ok(count)
    }

    fn take_request(&self) -> Option<PassScope> {
        lock_or_recover(&self.requested).take()
    }

    /// Waits up to `timeout` for a request. Returns whether one is waiting.
    fn wait_for_request(&self, timeout: Duration) -> bool {
        let requested = lock_or_recover(&self.requested);

        if requested.is_some() {
            return true;
        }

        let (requested, _) = self
            .request_made
            .wait_timeout(requested, timeout)
            .unwrap_or_else(std::sync::PoisonError::into_inner);

        requested.is_some()
    }

    pub fn recent_sessions(&self, limit: u32) -> Result<Vec<RecentSession>, String> {
        lock_or_recover(&self.db).recent_sessions(limit)
    }

    pub fn home_stats(&self) -> Result<HomeStats, String> {
        lock_or_recover(&self.db).home_stats(now())
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
    let mut scope = PassScope::Unread;

    loop {
        let met_the_sim = run_pass(service, host, scope);

        // A session driven during the pass wrote files the pass did not list.
        if !met_the_sim {
            wait_for_a_session_or_request(service, host);
        }

        scope = service.take_request().unwrap_or(PassScope::Unread);
    }
}

/// Reads the files of `scope` once. Returns whether the sim connected meanwhile.
pub fn run_pass(service: &StatsService, host: &StatsHost, scope: PassScope) -> bool {
    let folder = service.folder().path.map(PathBuf::from);
    let Some(folder) = folder.filter(|folder| folder.is_dir()) else {
        service.publish(host, phase_only(service, StatsImportPhase::NoFolder));

        return false;
    };

    let (pending, broken) = match list_session_files(&folder) {
        Ok(on_disk) => {
            let mut db = lock_or_recover(&service.db);
            let paths = on_disk.iter().map(|stamp| stamp.path.clone()).collect();

            if let Err(error) = db.forget_skipped_except(&paths) {
                tracing::warn!(%error, "skipped files not tidied");
            }

            let pending = match scope {
                PassScope::All => on_disk,
                PassScope::Unread => pending_files(on_disk, &db.known_files().unwrap_or_default()),
            };

            (pending, db.broken_count().unwrap_or_default())
        }
        Err(error) => {
            tracing::warn!(%error, folder = %folder.display(), "session file folder not listed");
            (Vec::new(), service.status().broken)
        }
    };

    let total = u32::try_from(pending.len()).unwrap_or(u32::MAX);
    let mut status = StatsImportStatus {
        phase: StatsImportPhase::Reading,
        done: 0,
        total,
        broken,
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

/// Until the sim has connected and gone again, or the main window asks for a
/// pass.
fn wait_for_a_session_or_request(service: &StatsService, host: &StatsHost) {
    while !(host.is_connected)() {
        if service.wait_for_request(host.poll) {
            return;
        }
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

    fn host(sink: Arc<RecordingSink>) -> StatsHost {
        StatsHost::new(sink, fake_reader, Box::new(|| false))
    }

    fn service(default_folder: Option<PathBuf>) -> StatsService {
        StatsService::new(StatsDb::open_in_memory().unwrap(), default_folder)
    }

    #[test]
    fn a_pass_reads_new_files_skips_broken_ones_and_reads_nothing_twice() {
        let folder = folder_with(&["a.ibt", "bb.ibt", "broken.ibt", "notes.txt"]);
        let sink = Arc::new(RecordingSink::default());
        let host = host(Arc::clone(&sink));
        let service = service(Some(folder.clone()));

        run_pass(&service, &host, PassScope::Unread);

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

        run_pass(&service, &host, PassScope::Unread);

        assert_eq!(service.status().total, 0);
        assert_eq!(
            sink.statuses.lock().unwrap().last().unwrap(),
            r#"{"phase":"idle","done":0,"total":0,"broken":1}"#
        );

        fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn a_full_pass_reads_every_file_again_the_skipped_ones_too() {
        let folder = folder_with(&["a.ibt", "broken.ibt"]);
        let host = host(Arc::new(RecordingSink::default()));
        let service = service(Some(folder.clone()));
        run_pass(&service, &host, PassScope::Unread);

        run_pass(&service, &host, PassScope::All);

        assert_eq!(service.status().total, 2);
        assert_eq!(service.status().broken, 1);
        assert_eq!(service.skipped_files().unwrap().len(), 1);
        assert_eq!(service.recent_sessions(10).unwrap().len(), 1);

        fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn a_chosen_folder_is_read_instead_of_the_sims_own() {
        let own = folder_with(&["a.ibt"]);
        let chosen = folder_with(&["bb.ibt", "ccc.ibt"]);
        let host = host(Arc::new(RecordingSink::default()));
        let service = service(Some(own.clone()));
        let chosen_path = chosen.to_string_lossy().into_owned();

        let folder = service.set_folder(Some(&chosen_path)).unwrap();
        run_pass(&service, &host, PassScope::Unread);

        assert_eq!(folder.path.as_deref(), Some(chosen_path.as_str()));
        assert!(!folder.is_default);
        assert_eq!(service.status().total, 2);
        assert_eq!(service.take_request(), Some(PassScope::Unread));

        let folder = service.set_folder(None).unwrap();

        assert!(folder.is_default);
        assert_eq!(folder.path, Some(own.to_string_lossy().into_owned()));

        fs::remove_dir_all(own).unwrap();
        fs::remove_dir_all(chosen).unwrap();
    }

    #[test]
    fn a_missing_folder_cannot_be_chosen() {
        let service = service(None);

        assert!(service.set_folder(Some("Z:/no/such/folder")).is_err());
        assert_eq!(service.folder().path, None);
    }

    #[test]
    fn a_full_pass_request_is_not_narrowed_by_a_later_one() {
        let service = service(None);

        service.request_pass(PassScope::All);
        service.request_pass(PassScope::Unread);

        assert!(service.wait_for_request(Duration::ZERO));
        assert_eq!(service.take_request(), Some(PassScope::All));
        assert_eq!(service.take_request(), None);
    }

    #[test]
    fn a_missing_folder_is_reported() {
        let sink = Arc::new(RecordingSink::default());
        let service = service(Some(PathBuf::from("Z:/no/such/folder")));

        run_pass(&service, &host(sink), PassScope::Unread);

        assert_eq!(service.status().phase, StatsImportPhase::NoFolder);
    }
}
