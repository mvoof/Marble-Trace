//! Commands that read and write the settings files in the config directory.
//!
//! The frontend owns the contents and the migration chain; the files are read
//! and written here, whole. Every write goes through a temporary file renamed
//! into place, and nothing is written on exit: a file this build locked is left
//! exactly as it was found.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use mt_model::utils::lock_or_recover;
use serde::Serialize;
use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};
use tracing::{info, warn};

use crate::settings_snapshot;

const SETTINGS_FILE: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";
const LAST_GOOD_FILE: &str = "settings.last-good.json";
const TRACK_SETTINGS_FILE: &str = "track-settings.json";
const TRACK_ROTATIONS_KEY: &str = "recorded-tracks";
const UTF8_BOM: &[u8] = b"\xEF\xBB\xBF";

/// Reads that fail for a reason other than a missing file are tried again
/// before the file counts as unreadable: on Windows an antivirus scan or a
/// sync client holds a file for a moment, and a file merely busy at start must
/// not lock the settings as corrupt.
const READ_ATTEMPTS: u32 = 3;
const READ_RETRY_DELAY: Duration = Duration::from_millis(150);

/// One change to the settings files at a time: `write_replacing` uses a fixed
/// temporary name, and a save racing a reset or a restore could put back the
/// file either just removed.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

/// Set by a reset, for the rest of the process: the app relaunches right
/// after, and a save still on its way must not write the old settings back.
static SETTINGS_SAVES_CLOSED: AtomicBool = AtomicBool::new(false);

/// What `load_settings` found on disk. Serialized as `{ "status": … }`, with
/// `settings` beside it when loaded.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum LoadedSettings {
    /// No file: a first start, or the one after a reset. Defaults are seeded.
    Missing,
    /// A file that is there but holds no settings document — empty,
    /// truncated, not JSON — or that could not be read at all. The frontend
    /// locks it and never writes over it.
    Unreadable,
    Loaded {
        settings: Value,
    },
}

#[cfg(feature = "dev")]
pub fn register_types(types: &mut specta::TypeCollection) {
    types.register::<LoadedSettings>();
}

/// File work off the async runtime: a save syncs the file to disk, and a
/// busy file is retried with a pause.
async fn run_blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| format!("file task failed: {e}"))?
}

fn write_lock() -> MutexGuard<'static, ()> {
    lock_or_recover(&WRITE_LOCK)
}

/// Reads `settings.json`. Only a file that does not exist is `Missing`: any
/// other failure, permission denied included, is `Unreadable`, since seeding
/// defaults over a file we merely could not read would destroy it.
#[tauri::command]
pub async fn load_settings(app: AppHandle) -> Result<LoadedSettings, String> {
    let dir = config_dir(&app)?;

    run_blocking(move || Ok(load_settings_from(&dir))).await
}

/// Writes `{"settings": …}` to `settings.json`, pretty-printed — users read
/// this file and send it to us. After a reset it writes nothing.
#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: Value) -> Result<(), String> {
    let dir = config_dir(&app)?;

    run_blocking(move || save_settings_to(&dir, settings)).await
}

/// The `recorded-tracks` object of `track-settings.json`, or `None` when there
/// is no file. An unreadable one is an error, so the caller never writes its
/// own few angles over the ones it could not read.
#[tauri::command]
pub async fn read_track_rotations(app: AppHandle) -> Result<Option<Value>, String> {
    let path = config_dir(&app)?.join(TRACK_SETTINGS_FILE);

    run_blocking(move || read_document(&path, TRACK_ROTATIONS_KEY)).await
}

/// Replaces `track-settings.json` with the given `recorded-tracks` object.
#[tauri::command]
pub async fn write_track_rotations(app: AppHandle, tracks: Value) -> Result<(), String> {
    let dir = config_dir(&app)?;

    run_blocking(move || {
        let _write_guard = write_lock();

        write_document(&dir, TRACK_SETTINGS_FILE, TRACK_ROTATIONS_KEY, tracks)
    })
    .await
}

/// `startMinimized` from the settings file, read before the main window has
/// loaded them. Anything short of a loaded file with the flag set is `false`.
pub fn start_minimized(app: &AppHandle) -> bool {
    let Ok(dir) = config_dir(app) else {
        return false;
    };

    match load_settings_from(&dir) {
        LoadedSettings::Loaded { settings } => settings
            .get("app")
            .and_then(|app_settings| app_settings.get("startMinimized"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
        LoadedSettings::Missing | LoadedSettings::Unreadable => false,
    }
}

#[tauri::command]
pub async fn log_settings_snapshot(settings: Value) -> Result<(), String> {
    settings_snapshot::log_settings_snapshot(&settings);

    Ok(())
}

/// Copies `settings.json` aside before the frontend writes a newly migrated
/// version over it.
///
/// Best effort by design: a failed backup must not stop the migration, or a
/// user with a read-only config directory could never upgrade.
#[tauri::command]
pub async fn backup_settings_file(app: AppHandle, suffix: String) -> Result<(), String> {
    if !suffix.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(format!("refusing suffix {suffix:?}"));
    }

    let dir = config_dir(&app)?;

    run_blocking(move || {
        let source = dir.join(SETTINGS_FILE);

        if !source.exists() {
            return Ok(());
        }

        let target = dir.join(format!("settings.{suffix}.bak"));

        std::fs::copy(&source, &target).map_err(|e| format!("copy failed: {e}"))?;

        info!("settings backed up to {}", target.display());

        Ok(())
    })
    .await
}

/// Copies `settings.json` to `settings.last-good.json` — the copy the lock
/// banner offers back when a later save leaves the live file unreadable.
///
/// The frontend calls this only after a file has loaded and hydrated as it is,
/// so a file locked for any reason never replaces the last good one. Best
/// effort, like `backup_settings_file`: a failed copy must not block startup.
#[tauri::command]
pub async fn keep_last_good_settings(app: AppHandle) -> Result<(), String> {
    let dir = config_dir(&app)?;

    run_blocking(move || keep_last_good(&dir)).await
}

/// When the last-good copy was written, in milliseconds since the Unix epoch,
/// or `None` when there is none or it holds no settings document.
#[tauri::command]
pub async fn last_good_settings_saved_at(app: AppHandle) -> Result<Option<u64>, String> {
    let dir = config_dir(&app)?;

    run_blocking(move || Ok(last_good_saved_at(&dir))).await
}

/// Puts the last-good copy back as `settings.json`, keeping the unreadable file
/// aside as `settings.corrupt-<unix seconds>.json` so it can still be sent to us.
///
/// The copy is moved, not copied: a start that loads it cleanly keeps it again,
/// and one that locks on it finds no copy to offer, instead of offering the
/// same one in a restore-and-relaunch loop.
///
/// The caller relaunches the app afterwards, so the restored file goes through
/// the whole load pipeline, migrations included.
#[tauri::command]
pub async fn restore_last_good_settings(app: AppHandle) -> Result<(), String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("clock before epoch: {e}"))?
        .as_secs();
    let dir = config_dir(&app)?;

    run_blocking(move || {
        let _write_guard = write_lock();

        restore_last_good(&dir, now)
    })
    .await
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| format!("no config dir: {e}"))
}

/// Whether the bytes are a file holding a `settings` object — the shape
/// `save_settings` writes, and the least a copy needs to be worth offering.
fn is_settings_document(bytes: &[u8]) -> bool {
    parse_json(bytes).is_ok_and(|document| document.get(SETTINGS_KEY).is_some_and(Value::is_object))
}

/// Parses a file a user may have edited: Notepad and other Windows editors
/// save UTF-8 with a byte order mark, which JSON does not allow.
fn parse_json(bytes: &[u8]) -> serde_json::Result<Value> {
    serde_json::from_slice(bytes.strip_prefix(UTF8_BOM).unwrap_or(bytes))
}

fn save_settings_to(dir: &Path, settings: Value) -> Result<(), String> {
    let _write_guard = write_lock();

    if SETTINGS_SAVES_CLOSED.load(Ordering::SeqCst) {
        info!("settings save skipped: the file was reset");

        return Ok(());
    }

    write_document(dir, SETTINGS_FILE, SETTINGS_KEY, settings)
}

/// Removes the file and closes saves, both under the write lock, so a save
/// already waiting on the lock finds them closed instead of writing the file
/// back.
fn delete_settings_in(dir: &Path) -> Result<(), String> {
    let _write_guard = write_lock();
    let target = dir.join(SETTINGS_FILE);

    SETTINGS_SAVES_CLOSED.store(true, Ordering::SeqCst);

    match std::fs::remove_file(&target) {
        Ok(()) => {
            info!("settings file deleted: {}", target.display());

            Ok(())
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("delete failed: {error}")),
    }
}

/// `fs::read`, tried again a few times on any error but a missing file.
fn read_with_retry(path: &Path) -> std::io::Result<Vec<u8>> {
    let mut attempt = 1;

    loop {
        match std::fs::read(path) {
            Err(error)
                if error.kind() != std::io::ErrorKind::NotFound && attempt < READ_ATTEMPTS =>
            {
                warn!("{} not readable yet ({error}), retrying", path.display());
                std::thread::sleep(READ_RETRY_DELAY);
                attempt += 1;
            }
            result => return result,
        }
    }
}

fn load_settings_from(dir: &Path) -> LoadedSettings {
    let path = dir.join(SETTINGS_FILE);

    match read_document(&path, SETTINGS_KEY) {
        Ok(None) => LoadedSettings::Missing,
        Ok(Some(settings)) if settings.is_object() => LoadedSettings::Loaded { settings },
        Ok(Some(_)) => {
            warn!("{}: `settings` is not an object", path.display());

            LoadedSettings::Unreadable
        }
        Err(error) => {
            warn!("{} is unreadable: {error}", path.display());

            LoadedSettings::Unreadable
        }
    }
}

/// The value under `key` in a JSON file. `Ok(None)` only when the file does
/// not exist; one that cannot be read or parsed, or lacks the key, is an error.
fn read_document(path: &Path, key: &str) -> Result<Option<Value>, String> {
    let bytes = match read_with_retry(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("read failed: {error}")),
    };

    let mut document = parse_json(&bytes).map_err(|e| format!("not JSON: {e}"))?;

    document
        .get_mut(key)
        .map(|value| Some(value.take()))
        .ok_or_else(|| format!("no {key:?} in the file"))
}

/// Writes `{ key: value }`, pretty-printed, through `write_replacing`. Creates
/// the config directory on a first start. The caller holds the write lock.
fn write_document(dir: &Path, file: &str, key: &str, value: Value) -> Result<(), String> {
    let mut document = Map::new();
    document.insert(key.to_owned(), value);

    let bytes = serde_json::to_vec_pretty(&Value::Object(document))
        .map_err(|e| format!("serialize failed: {e}"))?;

    std::fs::create_dir_all(dir).map_err(|e| format!("create config dir failed: {e}"))?;

    write_replacing(&dir.join(file), &bytes)
}

/// Writes through a temporary file renamed into place, so an interrupted write
/// leaves the old target whole instead of a truncated one. The temporary file
/// is synced before the rename: otherwise a power loss can land the rename on
/// disk ahead of the data, and the target is replaced by an empty file.
fn write_replacing(target: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut temporary_name = target.as_os_str().to_owned();
    temporary_name.push(".tmp");
    let temporary = PathBuf::from(temporary_name);

    let written = write_synced(&temporary, bytes)
        .and_then(|()| std::fs::rename(&temporary, target))
        .map_err(|e| format!("write failed: {e}"));

    if written.is_err() {
        let _ = std::fs::remove_file(&temporary);
    }

    written
}

fn write_synced(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let mut file = std::fs::File::create(path)?;
    file.write_all(bytes)?;

    file.sync_all()
}

/// Writes the contents rather than `fs::copy`ing the file: a copy keeps the
/// source's modification time on Windows, and the banner shows that time as
/// when the copy was made.
fn keep_last_good(dir: &Path) -> Result<(), String> {
    let contents =
        std::fs::read(dir.join(SETTINGS_FILE)).map_err(|e| format!("read failed: {e}"))?;

    if !is_settings_document(&contents) {
        return Err("live settings hold no settings document".to_owned());
    }

    let target = dir.join(LAST_GOOD_FILE);

    {
        let _write_guard = write_lock();

        write_replacing(&target, &contents)?;
    }

    info!("last good settings kept at {}", target.display());

    Ok(())
}

fn last_good_saved_at(dir: &Path) -> Option<u64> {
    let last_good = dir.join(LAST_GOOD_FILE);
    let contents = std::fs::read(&last_good).ok()?;

    if !is_settings_document(&contents) {
        return None;
    }

    let modified = std::fs::metadata(&last_good).ok()?.modified().ok()?;
    let since_epoch = modified.duration_since(UNIX_EPOCH).ok()?;

    u64::try_from(since_epoch.as_millis()).ok()
}

/// Two renames, each atomic: the live file aside, then the copy into its
/// place. When the second fails the first is undone, so a failed restore never
/// leaves the directory without `settings.json` — which the next start would
/// read as a fresh install and seed with defaults.
fn restore_last_good(dir: &Path, now_secs: u64) -> Result<(), String> {
    let last_good = dir.join(LAST_GOOD_FILE);
    let contents =
        std::fs::read(&last_good).map_err(|e| format!("no last good settings to restore: {e}"))?;

    if !is_settings_document(&contents) {
        return Err("the last good copy holds no settings document".to_owned());
    }

    let live = dir.join(SETTINGS_FILE);
    let aside = dir.join(format!("settings.corrupt-{now_secs}.json"));
    let moved_aside = live.exists();

    if moved_aside {
        std::fs::rename(&live, &aside).map_err(|e| format!("move aside failed: {e}"))?;

        info!("unreadable settings moved to {}", aside.display());
    }

    if let Err(error) = std::fs::rename(&last_good, &live) {
        if moved_aside {
            let _ = std::fs::rename(&aside, &live);
        }

        return Err(format!("restore failed: {error}"));
    }

    info!("settings restored from {}", last_good.display());

    Ok(())
}

/// Removes `settings.json` from disk.
///
/// The reset button is the only way out of a locked settings file, so it has to
/// leave nothing behind: an emptied file would load as unreadable and lock the
/// app again on the next start. A missing file is a fresh install, which is
/// exactly what a reset means.
///
/// The app relaunches right after, so saves stay closed from here on: a
/// debounced save still pending would otherwise write the old settings back.
#[tauri::command]
pub async fn delete_settings_file(app: AppHandle) -> Result<(), String> {
    let dir = config_dir(&app)?;

    run_blocking(move || delete_settings_in(&dir)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    const LAST_GOOD_CONTENT: &str = r#"{"settings":{"schemaVersion":1}}"#;
    const TRUNCATED_CONTENT: &str = r#"{"settings":{"sche"#;
    const NOW_SECS: u64 = 1_700_000_000;

    /// A temporary directory removed when the test ends, a failing one included.
    struct ScratchDir(PathBuf);

    impl std::ops::Deref for ScratchDir {
        type Target = Path;

        fn deref(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for ScratchDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn scratch_dir(name: &str) -> ScratchDir {
        let dir = std::env::temp_dir().join(format!("mt-settings-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("scratch dir");

        ScratchDir(dir)
    }

    fn read(dir: &Path, file: &str) -> String {
        std::fs::read_to_string(dir.join(file)).expect("file present")
    }

    #[test]
    fn keeping_copies_the_live_file_and_reports_when() {
        let dir = scratch_dir("keep");
        std::fs::write(dir.join(SETTINGS_FILE), LAST_GOOD_CONTENT).expect("write");

        assert_eq!(last_good_saved_at(&dir), None);

        keep_last_good(&dir).expect("kept");

        assert_eq!(read(&dir, LAST_GOOD_FILE), LAST_GOOD_CONTENT);
        assert!(last_good_saved_at(&dir).is_some());
        assert!(!dir.join(format!("{LAST_GOOD_FILE}.tmp")).exists());
    }

    #[test]
    fn keeping_refuses_a_live_file_without_settings() {
        let dir = scratch_dir("keep-broken");
        std::fs::write(dir.join(LAST_GOOD_FILE), LAST_GOOD_CONTENT).expect("write");
        std::fs::write(dir.join(SETTINGS_FILE), TRUNCATED_CONTENT).expect("write");

        assert!(keep_last_good(&dir).is_err());
        assert_eq!(read(&dir, LAST_GOOD_FILE), LAST_GOOD_CONTENT);
    }

    #[test]
    fn a_copy_without_settings_is_not_offered() {
        let dir = scratch_dir("broken-copy");
        std::fs::write(dir.join(LAST_GOOD_FILE), TRUNCATED_CONTENT).expect("write");

        assert_eq!(last_good_saved_at(&dir), None);
        assert!(restore_last_good(&dir, NOW_SECS).is_err());
    }

    #[test]
    fn restoring_moves_the_copy_back_and_keeps_the_broken_file_aside() {
        let dir = scratch_dir("restore");
        std::fs::write(dir.join(LAST_GOOD_FILE), LAST_GOOD_CONTENT).expect("write");
        std::fs::write(dir.join(SETTINGS_FILE), TRUNCATED_CONTENT).expect("write");

        restore_last_good(&dir, NOW_SECS).expect("restored");

        assert_eq!(read(&dir, SETTINGS_FILE), LAST_GOOD_CONTENT);
        assert!(!dir.join(LAST_GOOD_FILE).exists());
        assert_eq!(
            read(&dir, &format!("settings.corrupt-{NOW_SECS}.json")),
            TRUNCATED_CONTENT
        );
    }

    #[test]
    fn no_file_loads_as_missing() {
        let dir = scratch_dir("load-missing");

        assert!(matches!(load_settings_from(&dir), LoadedSettings::Missing));
    }

    #[test]
    fn an_empty_truncated_or_shapeless_file_loads_as_unreadable() {
        let dir = scratch_dir("load-unreadable");

        for contents in ["", TRUNCATED_CONTENT, "{}", r#"{"settings":1}"#, "[]"] {
            std::fs::write(dir.join(SETTINGS_FILE), contents).expect("write");

            assert!(
                matches!(load_settings_from(&dir), LoadedSettings::Unreadable),
                "{contents:?} should load as unreadable"
            );
        }
    }

    #[test]
    fn a_file_saved_with_a_byte_order_mark_loads() {
        let dir = scratch_dir("load-bom");
        let mut contents = UTF8_BOM.to_vec();
        contents.extend_from_slice(LAST_GOOD_CONTENT.as_bytes());
        std::fs::write(dir.join(SETTINGS_FILE), contents).expect("write");

        assert!(matches!(
            load_settings_from(&dir),
            LoadedSettings::Loaded { .. }
        ));
    }

    #[test]
    fn unreadable_track_settings_are_an_error_not_an_empty_map() {
        let dir = scratch_dir("tracks-unreadable");
        let path = dir.join(TRACK_SETTINGS_FILE);

        assert_eq!(read_document(&path, TRACK_ROTATIONS_KEY), Ok(None));

        std::fs::write(&path, TRUNCATED_CONTENT).expect("write");

        assert!(read_document(&path, TRACK_ROTATIONS_KEY).is_err());
    }

    /// The only test that touches `SETTINGS_SAVES_CLOSED`: it stays set for the
    /// rest of the test process, as it does for the app.
    #[test]
    fn a_reset_deletes_the_file_and_no_later_save_writes_it_back() {
        let dir = scratch_dir("reset");
        std::fs::write(dir.join(SETTINGS_FILE), LAST_GOOD_CONTENT).expect("write");

        delete_settings_in(&dir).expect("deleted");
        save_settings_to(&dir, serde_json::json!({ "schemaVersion": 1 })).expect("skipped");

        assert!(!dir.join(SETTINGS_FILE).exists());
    }

    #[test]
    fn a_file_that_cannot_be_read_loads_as_unreadable() {
        let dir = scratch_dir("load-not-a-file");
        std::fs::create_dir(dir.join(SETTINGS_FILE)).expect("a directory in its place");

        assert!(matches!(
            load_settings_from(&dir),
            LoadedSettings::Unreadable
        ));
    }

    #[test]
    fn saved_settings_load_back_and_stay_pretty_printed() {
        let dir = scratch_dir("save-load");
        let config_dir = dir.join("first-start");
        let settings = serde_json::json!({ "schemaVersion": 1, "app": { "startMinimized": true } });

        write_document(&config_dir, SETTINGS_FILE, SETTINGS_KEY, settings.clone()).expect("saved");

        let LoadedSettings::Loaded {
            settings: read_back,
        } = load_settings_from(&config_dir)
        else {
            panic!("saved settings should load");
        };

        assert_eq!(read_back, settings);
        assert!(read(&config_dir, SETTINGS_FILE).starts_with("{\n  \"settings\": {"));
        assert!(!config_dir.join(format!("{SETTINGS_FILE}.tmp")).exists());
    }

    #[test]
    fn restoring_without_a_copy_leaves_the_live_file_alone() {
        let dir = scratch_dir("no-copy");
        std::fs::write(dir.join(SETTINGS_FILE), TRUNCATED_CONTENT).expect("write");

        assert!(restore_last_good(&dir, NOW_SECS).is_err());
        assert_eq!(read(&dir, SETTINGS_FILE), TRUNCATED_CONTENT);
    }
}
