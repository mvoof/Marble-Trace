//! Companion applications — the other programs a sim rig needs running.
//!
//! Sits beside `input/` and `remote/` rather than inside the telemetry layers:
//! nothing here reads a frame. It answers three questions for the settings UI
//! — what is installed, what is running, what did we start — and does the
//! starting and stopping.

pub mod catalog;
pub mod icon;
pub mod process;
pub mod registry;

use std::collections::HashSet;

use crate::model::companions::{CompanionApp, CompanionStatus, DetectedApp};

/// Managed state: which instances this app owns.
#[derive(Default)]
pub struct CompanionsState {
    pub owned: process::OwnedProcesses,
}

/// The process this program shows up as, which is the launched file unless
/// the entry says otherwise.
fn executable_name(app: &CompanionApp) -> String {
    if let Some(name) = &app.process_name {
        if !name.is_empty() {
            return name.to_ascii_lowercase();
        }
    }

    // An entry added before the field existed carries no process name, and a
    // settings migration cannot invent one. The catalog already knows it, so
    // the answer is looked up by path instead of stored twice.
    if let Some(name) = catalog::process_name_for(&app.path) {
        return name.to_ascii_lowercase();
    }

    process::file_name_of(&app.path)
}

/// Lowercased directory the executable sits in, used to keep one entry per
/// installed program.
fn parent_folder(app: &DetectedApp) -> Option<String> {
    std::path::Path::new(&app.path)
        .parent()
        .map(|folder| folder.to_string_lossy().to_ascii_lowercase())
}

/// Walks the catalog and reports the entries whose executable is really there.
pub fn detect() -> Vec<DetectedApp> {
    let mut found = Vec::new();
    let mut seen = HashSet::new();

    for entry in catalog::CATALOG {
        for candidate in entry.candidates {
            let Some(path) = catalog::expand(candidate) else {
                continue;
            };

            if !std::path::Path::new(&path).is_file() {
                continue;
            }

            if !seen.insert(path.to_ascii_lowercase()) {
                continue;
            }

            found.push(DetectedApp {
                name: entry.name.to_string(),
                path,
                args: entry.args.to_string(),
                process_name: (!entry.process.is_empty()).then(|| entry.process.to_string()),
            });

            break;
        }
    }

    // The registry runs second on purpose: the catalog knows the name the user
    // calls the program and the arguments it needs, and an entry found both
    // ways should keep those rather than the installer's display name.
    //
    // A program's install folder holds more than one executable, and its
    // uninstall entry may point at any of them — SimHub records its package
    // manager. One entry per folder, and the catalog's choice wins.
    let mut folders: HashSet<String> = found.iter().filter_map(parent_folder).collect();

    for installed in registry::scan_installed() {
        if !seen.insert(installed.path.to_ascii_lowercase()) {
            continue;
        }

        if let Some(folder) = parent_folder(&installed) {
            if !folders.insert(folder) {
                continue;
            }
        }

        found.push(installed);
    }

    found
}

/// Live state of every configured program, in the order they were given.
pub fn statuses(apps: &[CompanionApp], state: &CompanionsState) -> Vec<CompanionStatus> {
    let running = process::running_processes();

    apps.iter()
        .map(|app| {
            let executable = executable_name(app);

            let matching: Vec<u32> = running
                .iter()
                .filter(|(name, _)| *name == executable)
                .map(|(_, pid)| *pid)
                .collect();

            // An owned pid that is no longer among them means the user closed
            // the program by hand, and this app no longer has a say over it.
            let owned = match state.owned.pid_of(&app.id) {
                Some(pid) if matching.contains(&pid) => {
                    state.owned.set_close_on_exit(&app.id, app.close_with_app);

                    true
                }
                Some(_) => {
                    state.owned.forget(&app.id);

                    false
                }
                None => false,
            };

            CompanionStatus {
                id: app.id.clone(),
                running: !matching.is_empty(),
                owned,
                exists: std::path::Path::new(&app.path).is_file(),
            }
        })
        .collect()
}

/// Starts one program, unless an instance of it is already running.
pub fn launch(app: &CompanionApp, state: &CompanionsState) -> Result<bool, String> {
    if !std::path::Path::new(&app.path).is_file() {
        return Err(format!("{} is not where it was: {}", app.name, app.path));
    }

    let executable = executable_name(app);

    if process::running_processes()
        .iter()
        .any(|(name, _)| *name == executable)
    {
        return Ok(false);
    }

    let pid = process::spawn(&app.path, &process::split_args(&app.args))?;

    state.owned.remember(&app.id, pid, app.close_with_app);

    tracing::info!(app = %app.name, pid, "companion app launched");

    Ok(true)
}

/// Closes one program — only ever the instance this app started.
pub fn close(app: &CompanionApp, state: &CompanionsState) -> Result<bool, String> {
    let Some(pid) = state.owned.pid_of(&app.id) else {
        return Ok(false);
    };

    state.owned.forget(&app.id);

    if !process::is_alive(pid) {
        return Ok(false);
    }

    process::terminate(pid)?;

    tracing::info!(app = %app.name, pid, "companion app closed");

    Ok(true)
}

/// How long a program is given to disappear from the process list before it is
/// reported as still running. Two seconds is longer than any of these take and
/// short enough that nobody watches the window hang on it.
const CLOSE_TIMEOUT: std::time::Duration = std::time::Duration::from_millis(2000);

const CLOSE_POLL: std::time::Duration = std::time::Duration::from_millis(100);

/// Closes everything marked to close with the app, then waits for it to be
/// gone. Returns the names that were still running when the wait ran out.
///
/// Called from the main window's close handler rather than left to the
/// `Destroyed` hook alone: by the time the window is destroyed the process is
/// on its way out, and a program that needs a moment to exit is a race nobody
/// wins. The hook stays as the backstop for a close this path never sees.
pub fn close_marked(apps: &[CompanionApp], state: &CompanionsState) -> Vec<String> {
    let marked: Vec<&CompanionApp> = apps.iter().filter(|app| app.close_with_app).collect();

    if marked.is_empty() {
        return Vec::new();
    }

    for app in &marked {
        if let Err(error) = close(app, state) {
            tracing::warn!(app = %app.name, %error, "companion app would not close");
        }

        // The manual button closes only what this app started; the switch is a
        // standing instruction about the program itself, and a user who set it
        // means the copy they started by hand as well. Restricting this to our
        // own pid is what made the switch look broken: a program started
        // before the overlay, or one launched through its updater, was never
        // ours to begin with.
        let closed = process::terminate_by_name(&executable_name(app));

        if closed > 0 {
            tracing::info!(app = %app.name, closed, "companion app closed on exit");
        }
    }

    let deadline = std::time::Instant::now() + CLOSE_TIMEOUT;

    loop {
        let running = process::running_processes();

        let stubborn: Vec<String> = marked
            .iter()
            .filter(|app| {
                let executable = executable_name(app);

                running.iter().any(|(name, _)| *name == executable)
            })
            .map(|app| app.name.clone())
            .collect();

        if stubborn.is_empty() || std::time::Instant::now() >= deadline {
            if !stubborn.is_empty() {
                tracing::warn!(apps = ?stubborn, "companion apps still running at exit");
            }

            return stubborn;
        }

        std::thread::sleep(CLOSE_POLL);
    }
}

/// Closes every instance this app owns and was asked to close with it. Called
/// once, on the way out.
pub fn close_all_owned(state: &CompanionsState) {
    for (id, owned) in state.owned.drain() {
        let pid = owned.pid;

        if !owned.close_on_exit || !process::is_alive(pid) {
            continue;
        }

        match process::terminate(pid) {
            Ok(()) => tracing::info!(id = %id, pid, "companion app closed on exit"),
            Err(error) => tracing::warn!(id = %id, pid, %error, "companion app would not close"),
        }
    }
}
