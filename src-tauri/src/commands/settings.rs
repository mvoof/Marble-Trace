//! Commands that read and write the settings files in the config directory.
//!
//! The frontend owns the contents and the migration chain; the files are read
//! and written here, whole. Every write goes through a temporary file renamed
//! into place, and nothing is written on exit: a file this build locked is left
//! exactly as it was found.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

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

/// One write at a time: `write_replacing` uses a fixed temporary name, and two
/// saves racing on it could rename a half-written file into place.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

/// What `load_settings` found on disk. Serialized as `{ "status": … }`, with
/// `settings` beside it when loaded.
#[derive(Debug, Serialize)]
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

/// Reads `settings.json`. Only a file that does not exist is `Missing`: any
/// other failure, permission denied included, is `Unreadable`, since seeding
/// defaults over a file we merely could not read would destroy it.
#[tauri::command]
pub async fn load_settings(app: AppHandle) -> Result<LoadedSettings, String> {
    Ok(load_settings_from(&config_dir(&app)?))
}

/// Writes `{"settings": …}` to `settings.json`, pretty-printed — users read
/// this file and send it to us.
#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: Value) -> Result<(), String> {
    write_document(&config_dir(&app)?, SETTINGS_FILE, SETTINGS_KEY, settings)
}

/// The `recorded-tracks` object of `track-settings.json`, or `None` when the
/// file is missing or unreadable — the angles are cheap to set again.
#[tauri::command]
pub async fn read_track_rotations(app: AppHandle) -> Result<Option<Value>, String> {
    let path = config_dir(&app)?.join(TRACK_SETTINGS_FILE);

    match read_document(&path, TRACK_ROTATIONS_KEY) {
        Ok(tracks) => Ok(tracks),
        Err(error) => {
            warn!("{} unreadable, read as empty: {error}", path.display());

            Ok(None)
        }
    }
}

/// Replaces `track-settings.json` with the given `recorded-tracks` object.
#[tauri::command]
pub async fn write_track_rotations(app: AppHandle, tracks: Value) -> Result<(), String> {
    write_document(
        &config_dir(&app)?,
        TRACK_SETTINGS_FILE,
        TRACK_ROTATIONS_KEY,
        tracks,
    )
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
    let source = dir.join(SETTINGS_FILE);

    if !source.exists() {
        return Ok(());
    }

    let target = dir.join(format!("settings.{suffix}.bak"));

    std::fs::copy(&source, &target).map_err(|e| format!("copy failed: {e}"))?;

    info!("settings backed up to {}", target.display());

    Ok(())
}

/// Copies `settings.json` to `settings.last-good.json` — the copy the lock
/// banner offers back when a later save leaves the live file unreadable.
///
/// The frontend calls this only after a file has loaded and hydrated as it is,
/// so a file locked for any reason never replaces the last good one. Best
/// effort, like `backup_settings_file`: a failed copy must not block startup.
#[tauri::command]
pub async fn keep_last_good_settings(app: AppHandle) -> Result<(), String> {
    keep_last_good(&config_dir(&app)?)
}

/// When the last-good copy was written, in milliseconds since the Unix epoch,
/// or `None` when there is none or it holds no settings document.
#[tauri::command]
pub async fn last_good_settings_saved_at(app: AppHandle) -> Result<Option<u64>, String> {
    Ok(last_good_saved_at(&config_dir(&app)?))
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

    restore_last_good(&config_dir(&app)?, now)
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| format!("no config dir: {e}"))
}

/// Whether the bytes are a file holding a `settings` object — the shape
/// `save_settings` writes, and the least a copy needs to be worth offering.
fn is_settings_document(bytes: &[u8]) -> bool {
    serde_json::from_slice::<Value>(bytes)
        .is_ok_and(|document| document.get(SETTINGS_KEY).is_some_and(Value::is_object))
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
    let bytes = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("read failed: {error}")),
    };

    let mut document =
        serde_json::from_slice::<Value>(&bytes).map_err(|e| format!("not JSON: {e}"))?;

    document
        .get_mut(key)
        .map(|value| Some(value.take()))
        .ok_or_else(|| format!("no {key:?} in the file"))
}

/// Writes `{ key: value }`, pretty-printed, through `write_replacing`. Creates
/// the config directory on a first start.
fn write_document(dir: &Path, file: &str, key: &str, value: Value) -> Result<(), String> {
    let mut document = Map::new();
    document.insert(key.to_owned(), value);

    let bytes = serde_json::to_vec_pretty(&Value::Object(document))
        .map_err(|e| format!("serialize failed: {e}"))?;

    std::fs::create_dir_all(dir).map_err(|e| format!("create config dir failed: {e}"))?;

    let _write_guard = lock_or_recover(&WRITE_LOCK);

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

    write_replacing(&target, &contents)?;

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
#[tauri::command]
pub async fn delete_settings_file(app: AppHandle) -> Result<(), String> {
    let target = config_dir(&app)?.join(SETTINGS_FILE);

    match std::fs::remove_file(&target) {
        Ok(()) => {
            info!("settings file deleted: {}", target.display());

            Ok(())
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("delete failed: {error}")),
    }
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
