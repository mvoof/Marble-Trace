//! The known-program catalog used by automatic detection.
//!
//! Deliberately a static list of install paths rather than a scan of the whole
//! disk: a rig has one SimHub and one Crew Chief, both in the folder their
//! installer always uses, and walking Program Files for every `.exe` would cost
//! seconds to find them. A program that is not here is added by hand, which is
//! the same two clicks a wrong guess would cost to undo.

/// One catalog entry: a display name and the paths to try, each relative to a
/// well-known root written as an environment variable.
pub struct CatalogEntry {
    pub name: &'static str,
    /// `%ENV_VAR%\\relative\\path.exe`, expanded before the file is looked for.
    pub candidates: &'static [&'static str],
    /// Command line the program needs, for the few that are started through a
    /// launcher rather than directly.
    pub args: &'static str,
    /// Name of the process the program actually runs as, when the launched
    /// file is not it. Empty means they are the same.
    pub process: &'static str,
}

pub const CATALOG: &[CatalogEntry] = &[
    CatalogEntry {
        name: "iRacing UI",
        args: "",
        process: "",
        candidates: &[
            "%ProgramFiles(x86)%\\iRacing\\ui\\iRacingUI.exe",
            "%ProgramFiles%\\iRacing\\ui\\iRacingUI.exe",
        ],
    },
    CatalogEntry {
        name: "SimHub",
        args: "",
        process: "",
        candidates: &[
            "%ProgramFiles(x86)%\\SimHub\\SimHubWPF.exe",
            "%ProgramFiles%\\SimHub\\SimHubWPF.exe",
        ],
    },
    CatalogEntry {
        name: "Crew Chief",
        args: "",
        process: "",
        candidates: &["%ProgramFiles(x86)%\\Britton IT Ltd\\CrewChiefV4\\CrewChiefV4.exe"],
    },
    CatalogEntry {
        name: "VoiceAttack",
        args: "",
        process: "",
        candidates: &[
            "%ProgramFiles(x86)%\\VoiceAttack\\VoiceAttack.exe",
            "%ProgramFiles%\\VoiceAttack\\VoiceAttack.exe",
        ],
    },
    CatalogEntry {
        name: "Trading Paints",
        args: "",
        process: "",
        candidates: &[
            "%LOCALAPPDATA%\\Trading Paints\\Trading Paints.exe",
            "%LOCALAPPDATA%\\Programs\\trading-paints\\Trading Paints.exe",
        ],
    },
    CatalogEntry {
        name: "Garage 61",
        args: "",
        process: "",
        candidates: &["%LOCALAPPDATA%\\Programs\\garage61-install\\Garage 61.exe"],
    },
    CatalogEntry {
        name: "MOZA Pit House",
        args: "",
        process: "",
        candidates: &["%ProgramFiles%\\MOZA\\MOZA Pit House\\MOZA Pit House.exe"],
    },
    CatalogEntry {
        name: "SimuCUBE",
        args: "",
        process: "",
        candidates: &[
            "%ProgramFiles(x86)%\\Granite Devices\\Simucube 2 True Drive\\Simucube2TrueDrive.exe",
        ],
    },
    CatalogEntry {
        name: "Fanatec Control Panel",
        args: "",
        process: "",
        candidates: &["%ProgramFiles%\\Fanatec\\Fanatec Wheel\\FanatecWheelPropertyPage.exe"],
    },
    // The daemon is the entry point, not `Simpro3\bin\simpro3.exe`: it checks
    // for updates and starts SimPro Manager itself. Launching the manager
    // directly would leave the rig with a window and no service behind it.
    CatalogEntry {
        name: "Simagic Daemon",
        args: "",
        process: "",
        candidates: &[
            "%ProgramFiles(x86)%\\Simagic\\Daemon\\simdaemon.exe",
            "%ProgramFiles%\\Simagic\\Daemon\\simdaemon.exe",
        ],
    },
    CatalogEntry {
        name: "Conspit Link",
        args: "",
        process: "",
        candidates: &[
            "%ProgramFiles(x86)%\\Conspit Link 2.0\\ConspitLink2.0.exe",
            "%ProgramFiles%\\Conspit Link 2.0\\ConspitLink2.0.exe",
        ],
    },
    CatalogEntry {
        name: "Tobii Game Hub",
        args: "",
        process: "",
        // `current` is a junction the updater repoints, so the path stays put
        // across versions.
        candidates: &["%LOCALAPPDATA%\\TobiiGameHub\\current\\TobiiGameHub.exe"],
    },
    CatalogEntry {
        name: "OBS Studio",
        args: "",
        process: "",
        candidates: &[
            "%ProgramFiles%\\obs-studio\\bin\\64bit\\obs64.exe",
            "%ProgramFiles(x86)%\\obs-studio\\bin\\64bit\\obs64.exe",
        ],
    },
    CatalogEntry {
        name: "Discord",
        args: "--processStart Discord.exe",
        process: "Discord.exe",
        candidates: &["%LOCALAPPDATA%\\Discord\\Update.exe"],
    },
    CatalogEntry {
        name: "TeamSpeak",
        args: "",
        process: "",
        candidates: &["%ProgramFiles%\\TeamSpeak 3 Client\\ts3client_win64.exe"],
    },
];

/// The process a catalogued program runs as, looked up by the path it is
/// launched from. `None` when the path is not in the catalog, or when the two
/// are the same file.
pub fn process_name_for(path: &str) -> Option<&'static str> {
    let wanted = path.to_ascii_lowercase();

    for entry in CATALOG {
        if entry.process.is_empty() {
            continue;
        }

        for candidate in entry.candidates {
            let Some(expanded) = expand(candidate) else {
                continue;
            };

            if expanded.to_ascii_lowercase() == wanted {
                return Some(entry.process);
            }
        }
    }

    None
}

/// Expands the `%VAR%` prefix of a candidate path. Returns `None` when the
/// variable is not set, which on a non-Windows build is every one of them.
pub fn expand(candidate: &str) -> Option<String> {
    let rest = candidate.strip_prefix('%')?;
    let (var, tail) = rest.split_once('%')?;
    let root = std::env::var(var).ok()?;

    Some(format!("{root}{tail}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_the_process_a_launcher_starts() {
        let Some(updater) = expand("%LOCALAPPDATA%\\Discord\\Update.exe") else {
            return;
        };

        assert_eq!(process_name_for(&updater), Some("Discord.exe"));
        assert_eq!(
            process_name_for(&updater.to_ascii_uppercase()),
            Some("Discord.exe")
        );
        assert_eq!(
            process_name_for("C:\\Program Files\\Whatever\\thing.exe"),
            None
        );
    }
}
