//! The stats import: from app start, the session files not yet read become
//! session records, one file at a time on a thread of its own, paused while
//! the sim is connected — the sim writes those files and wants the disk.
//!
//! The first pass waits for the main window to say which folder its settings
//! name (ADR-0015). After a pass it waits for the sim to come and go, then
//! looks again for the files that session wrote — or sooner, when the main
//! window changes the folder or asks to read every file again.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use mt_model::app::car_setup::CarSetupView;
use mt_model::app::stats::{
    AnalysisSet, HomeStats, KnownCar, LapRef, RecentSession, SessionFile, SessionFilter,
    SessionLaps, SessionPage, SkippedFile, StatsFolder, StatsImportPhase, StatsImportStatus,
};
use mt_model::contract::event_sink::EventSink;
use mt_model::contract::events::EVENT_STATS_IMPORT;
use mt_model::utils::lock_or_recover;

use crate::db::{FileStamp, StatsDb};
use crate::lap_cache::LapTelemetryReader;
use crate::lap_store::{pack_file, stored_lap_keys, FileAnalysis, StoredLap};
use crate::scan::{list_session_files, pending_files};

/// How often a waiting import looks at the sim's connection.
const CONNECTION_POLL: Duration = Duration::from_secs(3);
const THREAD_NAME: &str = "stats-import";
const UTF8_BOM: [u8; 3] = [0xEF, 0xBB, 0xBF];

/// Reads one session file; the sim's adapter provides it.
pub type SessionFileReader = fn(&Path) -> Result<SessionFile, String>;

/// Reads a file's car setup; the sim's adapter provides it.
pub type CarSetupReader = fn(&Path) -> Result<CarSetupView, String>;

/// How the sim's adapter reads its session files.
#[derive(Clone, Copy)]
pub struct SessionFileReaders {
    pub read_file: SessionFileReader,
    /// The stored channel set of the laps asked for.
    pub read_laps: LapTelemetryReader,
    pub read_setup: CarSetupReader,
}

/// What the import needs from the app.
pub struct StatsHost {
    pub sink: Arc<dyn EventSink>,
    pub readers: SessionFileReaders,
    pub is_connected: Box<dyn Fn() -> bool + Send + Sync>,
    /// Runs first on the import thread: the app lowers its priority there.
    pub on_thread_start: fn(),
    /// How long to wait between two looks at the connection.
    pub poll: Duration,
}

impl StatsHost {
    pub fn new(
        sink: Arc<dyn EventSink>,
        readers: SessionFileReaders,
        is_connected: Box<dyn Fn() -> bool + Send + Sync>,
        on_thread_start: fn(),
    ) -> Self {
        Self {
            sink,
            readers,
            is_connected,
            on_thread_start,
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
    /// The folder `settings.json` names: `None` until main says,
    /// `Some(None)` for the sim's own.
    chosen_folder: Mutex<Option<Option<String>>>,
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
            chosen_folder: Mutex::new(None),
            requested: Mutex::new(None),
            request_made: Condvar::new(),
        }
    }

    pub fn status(&self) -> StatsImportStatus {
        *lock_or_recover(&self.status)
    }

    /// The folder the driver chose, else the sim's own.
    pub fn folder(&self) -> StatsFolder {
        let chosen = lock_or_recover(&self.chosen_folder).clone().flatten();

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

    /// Reads from the folder `settings.json` names from now on; `None` is the
    /// sim's own. A folder missing on disk is taken too, and reported by the
    /// next pass. The next pass looks at it at once.
    pub fn set_folder(&self, folder: Option<&str>) -> StatsFolder {
        *lock_or_recover(&self.chosen_folder) = Some(folder.map(str::to_owned));
        self.request_pass(PassScope::Unread);

        self.folder()
    }

    /// Whether main has said which folder to read.
    fn folder_known(&self) -> bool {
        lock_or_recover(&self.chosen_folder).is_some()
    }

    /// The folder an older `stats.db` held, once, for `settings.json`.
    pub fn take_legacy_folder(&self) -> Option<String> {
        lock_or_recover(&self.db).take_legacy_folder()
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

    pub fn known_cars(&self) -> Result<Vec<KnownCar>, String> {
        lock_or_recover(&self.db).known_cars()
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

    pub fn sessions_page(&self, filter: &SessionFilter, page: u32) -> Result<SessionPage, String> {
        lock_or_recover(&self.db).sessions_page(filter, page)
    }

    /// A session's laps, each saying whether its file is still on disk.
    pub fn session_laps(&self, key: &str) -> Result<Option<SessionLaps>, String> {
        let laps = lock_or_recover(&self.db).session_laps(key)?;

        Ok(laps.map(|mut laps| {
            for lap in &mut laps.laps {
                lap.file_present = Path::new(&lap.lap.path).is_file();
            }

            laps
        }))
    }

    /// The analysis lap set, each lap saying whether its file is on disk.
    pub fn analysis_set(&self) -> Result<AnalysisSet, String> {
        let mut set = lock_or_recover(&self.db).analysis_set()?;

        for lap in &mut set.laps {
            lap.file_present = Path::new(&lap.lap.path).is_file();
        }

        Ok(set)
    }

    /// A lap's telemetry as `stats.db` keeps it, still packed.
    pub fn stored_lap(&self, lap: &LapRef) -> Result<Option<StoredLap>, String> {
        lock_or_recover(&self.db).lap_telemetry(lap)
    }

    /// The setup the database holds for a file, else the file's own; "file
    /// deleted" when neither has it.
    pub fn car_setup(
        &self,
        path: &str,
        read_setup: impl FnOnce(&Path) -> Result<CarSetupView, String>,
    ) -> Result<CarSetupView, String> {
        if let Some(setup) = lock_or_recover(&self.db).stored_setup(path)? {
            return Ok(setup);
        }

        let file = Path::new(path);

        if !file.is_file() {
            return Ok(CarSetupView::FileDeleted);
        }

        read_setup(file)
    }

    /// Runs `change` on the database, then answers the set as it now stands.
    pub fn change_analysis(
        &self,
        change: impl FnOnce(&mut StatsDb) -> Result<(), String>,
    ) -> Result<AnalysisSet, String> {
        change(&mut lock_or_recover(&self.db))?;

        self.analysis_set()
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
        .spawn(move || {
            (host.on_thread_start)();
            run(&service, &host);
        });

    if let Err(error) = spawned {
        tracing::error!(%error, "stats import thread not started");
    }
}

fn run(service: &StatsService, host: &StatsHost) {
    while !service.folder_known() {
        service.wait_for_request(host.poll);
    }

    let mut scope = service.take_request().unwrap_or(PassScope::Unread);

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
    let path = Path::new(&stamp.path);
    // Read outside the lock: a long file must not hold up the commands.
    let read = (host.readers.read_file)(path).map(|file| {
        let analysis = read_analysis(&host.readers, path, &file);

        (file, analysis)
    });
    let mut db = lock_or_recover(&service.db);
    let stored = match read {
        Ok((file, analysis)) => db.record_read_with(stamp, &file, &analysis, now()),
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

/// The kept laps' telemetry and the setup of a file read. What cannot be
/// read is left out: the session's facts are stored all the same.
fn read_analysis(readers: &SessionFileReaders, path: &Path, file: &SessionFile) -> FileAnalysis {
    let keys = stored_lap_keys(file);
    let laps = if keys.is_empty() {
        Vec::new()
    } else {
        (readers.read_laps)(path, &keys)
            .and_then(|telemetry| pack_file(&telemetry))
            .unwrap_or_else(|error| {
                tracing::warn!(%error, path = %path.display(), "lap telemetry not stored");
                Vec::new()
            })
    };
    let setup = match (readers.read_setup)(path) {
        Ok(setup @ CarSetupView::Setup { .. }) => Some(setup),
        Ok(CarSetupView::FileDeleted) => None,
        Err(error) => {
            tracing::warn!(%error, path = %path.display(), "car setup not stored");
            None
        }
    };

    FileAnalysis { laps, setup }
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
    use mt_model::app::lap_telemetry::{FileTelemetry, LapChannel, LapKey, LapTelemetry};
    use mt_model::app::stats::{LapRef, SessionFileLap, SessionFileRun};
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

    /// Every lap asked for, a speed channel holding the lap's number.
    fn fake_laps(_path: &Path, laps: &[LapKey]) -> Result<FileTelemetry, String> {
        Ok(FileTelemetry {
            points: 2,
            channels: vec![LapChannel {
                name: "Speed".into(),
                unit: "m/s".into(),
                description: String::new(),
            }],
            laps: laps
                .iter()
                .map(|lap| LapTelemetry {
                    lap: *lap,
                    values: vec![vec![lap.lap_num as f32; 2]],
                })
                .collect(),
        })
    }

    fn fake_setup(_path: &Path) -> Result<CarSetupView, String> {
        Ok(CarSetupView::Setup {
            name: Some("race.sto".into()),
            groups: Vec::new(),
        })
    }

    const READERS: SessionFileReaders = SessionFileReaders {
        read_file: fake_reader,
        read_laps: fake_laps,
        read_setup: fake_setup,
    };

    fn host(sink: Arc<RecordingSink>) -> StatsHost {
        StatsHost::new(sink, READERS, Box::new(|| false), || {})
    }

    /// A practice run: an out-lap off pit road, two full laps, an in-lap.
    fn reader_with_laps(_path: &Path) -> Result<SessionFile, String> {
        let lap = |lap_num, in_pit, partial| SessionFileLap {
            lap_num,
            time_s: Some(100.0),
            in_pit,
            partial,
            incidents: 0,
        };

        Ok(SessionFile {
            subsession_id: Some(9),
            event_type: "Practice".into(),
            runs: vec![SessionFileRun {
                session_num: 0,
                laps: vec![
                    lap(1, true, true),
                    lap(2, false, false),
                    lap(3, false, false),
                    lap(4, true, false),
                ],
                ..SessionFileRun::default()
            }],
            ..SessionFile::default()
        })
    }

    #[test]
    fn a_pass_stores_the_full_laps_and_the_setup_of_a_file() {
        let folder = folder_with(&["a.ibt"]);
        let host = StatsHost::new(
            Arc::new(RecordingSink::default()),
            SessionFileReaders {
                read_file: reader_with_laps,
                ..READERS
            },
            Box::new(|| false),
            || {},
        );
        let service = service(Some(folder.clone()));
        let path = folder.join("a.ibt").to_string_lossy().into_owned();

        run_pass(&service, &host, PassScope::Unread);

        let db = lock_or_recover(&service.db);
        let stored: Vec<i32> = (1..=4)
            .filter(|lap_num| {
                db.lap_telemetry(&LapRef {
                    path: path.clone(),
                    session_num: 0,
                    lap_num: *lap_num,
                })
                .unwrap()
                .is_some()
            })
            .collect();
        assert_eq!(stored, vec![2, 3]);
        assert!(db.stored_setup(&path).unwrap().is_some());
        drop(db);

        fs::remove_dir_all(folder).unwrap();
    }

    fn unreadable_setup(_path: &Path) -> Result<CarSetupView, String> {
        Err("the file is not read for a stored setup".into())
    }

    #[test]
    fn a_deleted_files_laps_and_setup_are_still_there_from_the_database() {
        let folder = folder_with(&["a.ibt"]);
        let host = StatsHost::new(
            Arc::new(RecordingSink::default()),
            SessionFileReaders {
                read_file: reader_with_laps,
                ..READERS
            },
            Box::new(|| false),
            || {},
        );
        let service = service(Some(folder.clone()));
        let path = folder.join("a.ibt").to_string_lossy().into_owned();

        run_pass(&service, &host, PassScope::Unread);
        fs::remove_dir_all(&folder).unwrap();

        let key = service.recent_sessions(1).unwrap()[0].key.clone();
        let laps = service.session_laps(&key).unwrap().unwrap().laps;
        let stored: Vec<(i32, bool, bool)> = laps
            .iter()
            .map(|lap| (lap.lap.lap_num, lap.stored, lap.file_present))
            .collect();

        assert_eq!(
            stored,
            vec![
                (1, false, false),
                (2, true, false),
                (3, true, false),
                (4, false, false)
            ]
        );
        assert!(matches!(
            service.car_setup(&path, unreadable_setup),
            Ok(CarSetupView::Setup { .. })
        ));
        assert_eq!(
            service.car_setup("Z:/no/such.ibt", unreadable_setup),
            Ok(CarSetupView::FileDeleted)
        );
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

        let folder = service.set_folder(Some(&chosen_path));
        run_pass(&service, &host, PassScope::Unread);

        assert_eq!(folder.path.as_deref(), Some(chosen_path.as_str()));
        assert!(!folder.is_default);
        assert_eq!(service.status().total, 2);
        assert_eq!(service.take_request(), Some(PassScope::Unread));

        let folder = service.set_folder(None);

        assert!(folder.is_default);
        assert_eq!(folder.path, Some(own.to_string_lossy().into_owned()));

        fs::remove_dir_all(own).unwrap();
        fs::remove_dir_all(chosen).unwrap();
    }

    #[test]
    fn a_missing_chosen_folder_is_taken_and_reported_by_the_pass() {
        let host = host(Arc::new(RecordingSink::default()));
        let service = service(None);

        let folder = service.set_folder(Some("Z:/no/such/folder"));
        run_pass(&service, &host, PassScope::Unread);

        assert_eq!(folder.path.as_deref(), Some("Z:/no/such/folder"));
        assert_eq!(service.status().phase, StatsImportPhase::NoFolder);
    }

    #[test]
    fn the_folder_is_unknown_until_main_names_one_even_the_sims_own() {
        let service = service(None);

        assert!(!service.folder_known());

        service.set_folder(None);

        assert!(service.folder_known());
        assert_eq!(service.take_request(), Some(PassScope::Unread));
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
