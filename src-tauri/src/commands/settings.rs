//! Commands that touch `settings.json` itself.
//!
//! The frontend owns the contents — these exist because `tauri-plugin-store`
//! can only read and write the live file, and the migration chain needs to know
//! whether a file is absent or merely unreadable, and to move one aside before
//! it rewrites it.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;
use tauri::{AppHandle, Manager};
use tracing::info;

use crate::settings_snapshot;

const SETTINGS_FILE: &str = "settings.json";
const LAST_GOOD_FILE: &str = "settings.last-good.json";

#[tauri::command]
pub async fn log_settings_snapshot(settings: Value) -> Result<(), String> {
    settings_snapshot::log_settings_snapshot(&settings);

    Ok(())
}

/// Whether `settings.json` exists on disk, empty or not.
///
/// `tauri-plugin-store` hands the frontend an empty store both for a fresh
/// install and for a file it could not parse — a stray BOM, a truncated write.
/// Those two need opposite responses, and only the filesystem can tell them
/// apart: the first should be seeded with defaults, the second must never be
/// written over. A zero-byte file is the second: the plugin's `fs::write`
/// truncates before it writes, so a save cut short most often leaves exactly
/// that — and seeding defaults over it would, one start later, replace the
/// last-good copy with them.
#[tauri::command]
pub async fn settings_file_exists(app: AppHandle) -> Result<bool, String> {
    Ok(std::fs::metadata(config_dir(&app)?.join(SETTINGS_FILE))
        .map(|meta| meta.is_file())
        .unwrap_or(false))
}

/// Copies `settings.json` aside before the frontend writes a newly migrated
/// version over it. `tauri-plugin-store` can only read and write the live file,
/// so the copy has to happen here.
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
/// the whole load pipeline, migrations included. The store plugin must not hold
/// `settings.json` open by then — it saves every open store on exit, and would
/// write its empty cache over the restored file. A locked main window closes it.
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

/// Whether the bytes are a store file holding a `settings` object — the shape
/// `tauri-plugin-store` writes, and the least a copy needs to be worth offering.
fn is_settings_document(bytes: &[u8]) -> bool {
    serde_json::from_slice::<Value>(bytes)
        .is_ok_and(|document| document.get("settings").is_some_and(Value::is_object))
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
/// leave nothing behind: `tauri-plugin-store`'s own `clear()` + `save()` writes
/// an empty `{}` over the file, which `settings_file_exists` then reports as a
/// file present but unreadable — locking the app again on the next start.
///
/// A missing file is a fresh install, which is exactly what a reset means.
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

    fn scratch_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("mt-settings-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("scratch dir");

        dir
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
    fn restoring_without_a_copy_leaves_the_live_file_alone() {
        let dir = scratch_dir("no-copy");
        std::fs::write(dir.join(SETTINGS_FILE), TRUNCATED_CONTENT).expect("write");

        assert!(restore_last_good(&dir, NOW_SECS).is_err());
        assert_eq!(read(&dir, SETTINGS_FILE), TRUNCATED_CONTENT);
    }
}
