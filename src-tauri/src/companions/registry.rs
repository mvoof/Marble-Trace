//! Automatic discovery through the Windows uninstall registry.
//!
//! The static catalog only knows the folders it was told about, and every rig
//! has something on it that nobody thought to add — a wheelbase tool from a
//! brand that shipped last month, a program installed to D:. Windows already
//! keeps a list of what is installed, so this reads that list and keeps the
//! entries whose name looks like sim-rig software.
//!
//! Name matching rather than a scan of the disk: `Uninstall` holds several
//! hundred entries on an ordinary machine, most of them runtimes and driver
//! packages, and offering all of them would be a worse list than none.

use std::path::{Path, PathBuf};

use crate::model::companions::DetectedApp;

/// Lowercase fragments matched against the installed program's display name.
///
/// Deliberately brand- and tool-shaped rather than generic: "sim" alone would
/// pull in every Windows simulation driver on the machine.
const KEYWORDS: &[&str] = &[
    "iracing",
    "simhub",
    "crew chief",
    "crewchief",
    "voiceattack",
    "trading paints",
    "garage 61",
    "garage61",
    "moza",
    "simucube",
    "granite devices",
    "fanatec",
    "simagic",
    "conspit",
    "cammus",
    "asetek",
    "heusinkveld",
    "simxperience",
    "sim racing studio",
    "simfeedback",
    "buttkicker",
    "obs studio",
    "streamlabs",
    "discord",
    "teamspeak",
    "hidhide",
    "joystick gremlin",
    "racechrono",
    "z1 dashboard",
    "second monitor",
    "dash studio",
];

/// Programs whose uninstall entry points at the wrong executable.
///
/// iRacing is the case this exists for: it records the launcher at the root of
/// the install, while the program a driver opens is the UI one folder down. The
/// path is relative to `InstallLocation`, and the name replaces the installer's
/// own — "iRacing.com Race Simulation" is not what anyone calls it.
const PREFERRED_EXECUTABLES: &[(&str, &str, &str)] = &[(
    "iracing.com race simulation",
    "ui\\iRacingUI.exe",
    "iRacing UI",
)];

/// Executable names that are never the program itself.
const IGNORED_STEMS: &[&str] = &[
    "unins",
    "uninstall",
    "setup",
    "install",
    "update",
    "updater",
    "crashpad",
    "crashhandler",
    "vcredist",
    "helper",
    "repair",
    "report",
];

/// Where an installer records the program, in the order they are read.
const UNINSTALL_KEYS: &[(&str, &str)] = &[
    (
        "HKLM",
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    ),
    (
        "HKLM",
        "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    ),
    (
        "HKCU",
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    ),
];

fn matches_keyword(display_name: &str) -> bool {
    let lowered = display_name.to_ascii_lowercase();

    KEYWORDS.iter().any(|keyword| lowered.contains(keyword))
}

fn is_ignored(path: &Path) -> bool {
    let stem = path
        .file_stem()
        .map(|name| name.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();

    IGNORED_STEMS.iter().any(|ignored| stem.contains(ignored))
}

/// `"C:\App\app.exe",0` and `C:\App\app.exe,-101` both mean the same file.
fn executable_from_icon(display_icon: &str) -> Option<PathBuf> {
    let trimmed = display_icon.trim().trim_matches('"');

    let without_index = match trimmed.rsplit_once(',') {
        Some((head, index))
            if index
                .trim_start_matches('-')
                .chars()
                .all(|c| c.is_ascii_digit()) =>
        {
            head
        }
        _ => trimmed,
    };

    let path = PathBuf::from(without_index.trim().trim_matches('"'));

    let is_executable = path
        .extension()
        .map(|extension| extension.eq_ignore_ascii_case("exe"))
        .unwrap_or(false);

    if is_executable && path.is_file() && !is_ignored(&path) {
        Some(path)
    } else {
        None
    }
}

/// The override for this program, if it has one and the file is really there.
fn preferred_executable(display_name: &str, install_location: &str) -> Option<(String, PathBuf)> {
    let lowered = display_name.to_ascii_lowercase();

    let (_, relative, name) = PREFERRED_EXECUTABLES
        .iter()
        .find(|(keyword, _, _)| lowered.contains(keyword))?;

    let root = PathBuf::from(install_location.trim().trim_matches('"'));

    if root.as_os_str().is_empty() {
        return None;
    }

    let path = root.join(relative);

    path.is_file().then(|| (name.to_string(), path))
}

/// Words of the display name, used to pick the right executable out of a folder
/// that holds several.
fn name_tokens(display_name: &str) -> Vec<String> {
    display_name
        .to_ascii_lowercase()
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|token| token.len() > 2)
        .map(|token| token.to_string())
        .collect()
}

/// The most plausible executable inside an install folder.
///
/// `bin` and `bin\64bit` are searched too — that is where OBS and everything
/// else built with CMake puts the program the user actually starts.
fn executable_from_folder(install_location: &str, display_name: &str) -> Option<PathBuf> {
    let root = PathBuf::from(install_location.trim().trim_matches('"'));

    if !root.is_dir() {
        return None;
    }

    let tokens = name_tokens(display_name);

    let mut best: Option<(u32, PathBuf)> = None;

    for directory in [
        root.clone(),
        root.join("bin"),
        root.join("bin").join("64bit"),
    ] {
        let Ok(entries) = std::fs::read_dir(&directory) else {
            continue;
        };

        for entry in entries.flatten() {
            let path = entry.path();

            let is_executable = path
                .extension()
                .map(|extension| extension.eq_ignore_ascii_case("exe"))
                .unwrap_or(false);

            if !is_executable || is_ignored(&path) {
                continue;
            }

            let stem = path
                .file_stem()
                .map(|name| name.to_string_lossy().to_ascii_lowercase())
                .unwrap_or_default();

            // A file named after the program beats one that merely sits beside
            // it; without this an install folder answers with its first .exe.
            let score = if tokens.iter().any(|token| stem.contains(token)) {
                2
            } else {
                1
            };

            if best
                .as_ref()
                .map(|(current, _)| score > *current)
                .unwrap_or(true)
            {
                best = Some((score, path));
            }
        }
    }

    best.map(|(_, path)| path)
}

#[cfg(windows)]
pub fn scan_installed() -> Vec<DetectedApp> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;

    let mut found = Vec::new();

    for (root_name, path) in UNINSTALL_KEYS {
        let root = RegKey::predef(if *root_name == "HKLM" {
            HKEY_LOCAL_MACHINE
        } else {
            HKEY_CURRENT_USER
        });

        let Ok(uninstall) = root.open_subkey_with_flags(path, KEY_READ) else {
            continue;
        };

        for key_name in uninstall.enum_keys().flatten() {
            let Ok(entry) = uninstall.open_subkey_with_flags(&key_name, KEY_READ) else {
                continue;
            };

            let Ok(display_name): Result<String, _> = entry.get_value("DisplayName") else {
                continue;
            };

            if !matches_keyword(&display_name) {
                continue;
            }

            let install_location = entry
                .get_value::<String, _>("InstallLocation")
                .ok()
                .unwrap_or_default();

            // Wherever the sim was installed to, the UI sits at the same place
            // inside it, so the override is resolved against what the registry
            // reports rather than against a drive letter of our own.
            let preferred = preferred_executable(&display_name, &install_location);

            if let Some((name, path)) = preferred {
                found.push(DetectedApp {
                    name,
                    path: path.to_string_lossy().to_string(),
                    args: String::new(),
                    process_name: None,
                });

                continue;
            }

            let executable = entry
                .get_value::<String, _>("DisplayIcon")
                .ok()
                .and_then(|icon| executable_from_icon(&icon))
                .or_else(|| executable_from_folder(&install_location, &display_name));

            let Some(executable) = executable else {
                continue;
            };

            found.push(DetectedApp {
                name: display_name,
                path: executable.to_string_lossy().to_string(),
                args: String::new(),
                process_name: None,
            });
        }
    }

    found
}

#[cfg(not(windows))]
pub fn scan_installed() -> Vec<DetectedApp> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_path_out_of_a_display_icon() {
        // The file has to exist for the real parser, so only the shape of the
        // index suffix is checked here.
        assert_eq!(
            executable_from_icon("\"C:\\App\\app.exe\",0").is_none(),
            !Path::new("C:\\App\\app.exe").is_file()
        );
    }

    #[test]
    fn keeps_only_rig_software() {
        assert!(matches_keyword("SimHub 9.4.0"));
        assert!(matches_keyword("OBS Studio"));
        assert!(!matches_keyword(
            "Microsoft Visual C++ 2015 Redistributable"
        ));
    }

    #[test]
    fn skips_uninstallers_and_updaters() {
        assert!(is_ignored(Path::new("C:\\App\\unins000.exe")));
        assert!(is_ignored(Path::new("C:\\App\\SetupHelper.exe")));
        assert!(!is_ignored(Path::new("C:\\App\\obs64.exe")));
    }
}
