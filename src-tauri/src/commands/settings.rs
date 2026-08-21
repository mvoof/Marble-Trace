//! Commands that touch `settings.json` itself.
//!
//! The frontend owns the contents — these exist because `tauri-plugin-store`
//! can only read and write the live file, and the migration chain needs to know
//! whether a file is absent or merely unreadable, and to move one aside before
//! it rewrites it.

use tauri::{AppHandle, Manager};
use tracing::info;

#[tauri::command]
pub async fn log_settings_snapshot(settings: serde_json::Value) -> Result<(), String> {
    crate::logging::log_settings_snapshot(&settings);

    Ok(())
}

/// Whether `settings.json` exists on disk with content in it.
///
/// `tauri-plugin-store` hands the frontend an empty store both for a fresh
/// install and for a file it could not parse — a stray BOM, a truncated write.
/// Those two need opposite responses, and only the filesystem can tell them
/// apart: the first should be seeded with defaults, the second must never be
/// written over.
#[tauri::command]
pub async fn settings_file_exists(app: AppHandle) -> Result<bool, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no config dir: {e}"))?;

    Ok(std::fs::metadata(dir.join("settings.json"))
        .map(|meta| meta.is_file() && meta.len() > 0)
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

    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no config dir: {e}"))?;

    let source = dir.join("settings.json");

    if !source.exists() {
        return Ok(());
    }

    let target = dir.join(format!("settings.{suffix}.bak"));

    std::fs::copy(&source, &target).map_err(|e| format!("copy failed: {e}"))?;

    info!("settings backed up to {}", target.display());

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
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("no config dir: {e}"))?;

    let target = dir.join("settings.json");

    match std::fs::remove_file(&target) {
        Ok(()) => {
            info!("settings file deleted: {}", target.display());

            Ok(())
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("delete failed: {error}")),
    }
}
