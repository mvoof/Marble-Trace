//! What the installer recorded about this app, versus what is actually running.
//!
//! Windows lets two installations of the same app coexist: the NSIS installer
//! keeps one uninstall entry per product, so installing a second copy into
//! another folder rewrites that entry and leaves the first copy on disk —
//! running, shortcut intact, and invisible to the updater, which resolves its
//! target directory from exactly that entry. The orphan then keeps launching an
//! old build over a settings file the new one has already migrated, and the
//! only symptom the user sees is the settings lock.

use serde::{Deserialize, Serialize};

/// Reported only when the running executable sits outside the directory the
/// installer registered — never for a normal install, and never when there is
/// no registry entry to compare against (a portable copy, a build run straight
/// out of `target/`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct InstallMismatch {
    /// Directory the running executable was launched from.
    pub running_dir: String,
    /// Version of the running executable.
    pub running_version: String,
    /// Directory the installer recorded as the installation.
    pub registered_dir: String,
    /// Version recorded beside it, when the entry carries one.
    pub registered_version: Option<String>,
}
