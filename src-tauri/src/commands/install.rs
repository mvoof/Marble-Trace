//! Does the running executable belong to the installation Windows knows about?
//!
//! See `model::install` for why two installations can coexist at all. This is
//! the check that turns that situation into something the user can read,
//! instead of the settings lock they get today — the lock is a symptom of an
//! old build being launched, and says nothing about which build or from where.
//!
//! # Temporary — remove at `REMOVE_AT`
//!
//! This exists for one migration: the `.msi` bundle was dropped in 0.25.0, so
//! everyone who installed from it gets an NSIS installer as their next update,
//! which lands in its own directory and leaves the MSI copy behind. The banner
//! is what tells those users what happened. Once they have moved over, a
//! second copy is a self-inflicted situation and not worth a startup check.
//!
//! Deleting it means this file, `model::install`, the `check_install_integrity`
//! registration in `lib.rs`, `install.service.ts`, `AppSettingsStore
//! .installMismatch`, `InstallMismatchBanner` and the `installMismatch` block
//! in all four locales. The test at the bottom fails once `REMOVE_AT` is
//! reached, so nobody has to remember on their own.

use crate::model::install::InstallMismatch;

#[cfg(windows)]
const UNINSTALL_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\Marble Trace";

/// `Some` only when the two directories genuinely differ.
///
/// Everything that cannot be answered reads as `None`: a copy with no uninstall
/// entry is portable or was installed by a bundle type we no longer ship, and
/// guessing on its behalf would put a permanent banner in front of a user with
/// nothing wrong.
#[tauri::command]
pub async fn check_install_integrity() -> Result<Option<InstallMismatch>, String> {
    Ok(detect_mismatch())
}

#[cfg(not(windows))]
fn detect_mismatch() -> Option<InstallMismatch> {
    None
}

#[cfg(windows)]
fn detect_mismatch() -> Option<InstallMismatch> {
    use tauri::utils::platform::bundle_type;
    use tracing::warn;
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;

    // A binary with no bundle marker was never installed — `cargo run`, `tauri
    // dev`, a copy someone unzipped. It has no installation to disagree with.
    bundle_type()?;

    let running_dir = std::env::current_exe()
        .ok()?
        .parent()
        .map(std::path::Path::to_path_buf)?;

    let entry = [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE]
        .into_iter()
        .find_map(|root| {
            RegKey::predef(root)
                .open_subkey_with_flags(UNINSTALL_KEY, KEY_READ)
                .ok()
        })?;

    let registered_dir = entry.get_value::<String, _>("InstallLocation").ok()?;
    let registered_dir = std::path::PathBuf::from(registered_dir.trim().trim_matches('"'));

    if same_directory(&running_dir, &registered_dir) {
        return None;
    }

    let registered_version = entry.get_value::<String, _>("DisplayVersion").ok();

    warn!(
        running = %running_dir.display(),
        registered = %registered_dir.display(),
        registered_version = registered_version.as_deref().unwrap_or("unknown"),
        "running an executable outside the registered installation"
    );

    Some(InstallMismatch {
        running_dir: running_dir.to_string_lossy().into_owned(),
        running_version: env!("CARGO_PKG_VERSION").to_string(),
        registered_dir: registered_dir.to_string_lossy().into_owned(),
        registered_version,
    })
}

/// Windows paths differ in case, in trailing separators and — for a directory
/// reached through a junction or an 8.3 name — in spelling. `canonicalize`
/// settles all three, and a path that cannot be canonicalized (the registered
/// directory has been deleted) falls back to a case-insensitive comparison
/// rather than reporting a mismatch that is really a missing folder.
#[cfg(windows)]
fn same_directory(left: &std::path::Path, right: &std::path::Path) -> bool {
    match (std::fs::canonicalize(left), std::fs::canonicalize(right)) {
        (Ok(left), Ok(right)) => left == right,
        _ => {
            let normalize = |path: &std::path::Path| {
                path.to_string_lossy()
                    .trim_end_matches(['\\', '/'])
                    .to_ascii_lowercase()
            };

            normalize(left) == normalize(right)
        }
    }
}

#[cfg(test)]
mod tests {
    /// First version that must no longer carry the check — see the module doc.
    ///
    /// Four minor releases after the `.msi` was dropped in 0.25.0: long enough
    /// that a user who opens the app once a season has been told, short enough
    /// that the code does not become furniture.
    const REMOVE_AT: (u32, u32) = (0, 29);

    fn minor_version() -> (u32, u32) {
        let mut parts = env!("CARGO_PKG_VERSION")
            .split('.')
            .filter_map(|part| part.parse::<u32>().ok());

        (
            parts.next().unwrap_or_default(),
            parts.next().unwrap_or_default(),
        )
    }

    /// Fails the build once the migration window has passed, rather than
    /// leaving a comment nobody reads again.
    #[test]
    fn is_still_inside_its_migration_window() {
        assert!(
            minor_version() < REMOVE_AT,
            "the .msi migration window has closed at v{}.{}: delete the install \
             mismatch check and everything listed in the module doc of \
             commands/install.rs",
            REMOVE_AT.0,
            REMOVE_AT.1
        );
    }
}
