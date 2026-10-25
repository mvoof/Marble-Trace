//! Finding, starting and stopping the configured programs.
//!
//! "Is it running" is answered by executable name rather than by full path:
//! Windows reports a bare `SimHub.exe` for a process started from anywhere, and
//! a user who moved the folder still means the same program. The narrower
//! question — is *this* instance ours — is answered by the pid we kept.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

/// One instance this app started.
#[derive(Clone, Copy)]
pub struct OwnedProcess {
    pub pid: u32,
    /// Whether the user asked for it to be closed together with the overlay.
    /// Carried here rather than read from the settings file on the way out:
    /// the exit path has no settings, and the flag is refreshed on every
    /// status poll while the app runs.
    pub close_on_exit: bool,
}

/// The instances this app started, by companion id.
#[derive(Default)]
pub struct OwnedProcesses {
    inner: Mutex<HashMap<String, OwnedProcess>>,
}

impl OwnedProcesses {
    pub fn remember(&self, id: &str, pid: u32, close_on_exit: bool) {
        if let Ok(mut owned) = self.inner.lock() {
            owned.insert(id.to_string(), OwnedProcess { pid, close_on_exit });
        }
    }

    pub fn set_close_on_exit(&self, id: &str, close_on_exit: bool) {
        if let Ok(mut owned) = self.inner.lock() {
            if let Some(entry) = owned.get_mut(id) {
                entry.close_on_exit = close_on_exit;
            }
        }
    }

    pub fn forget(&self, id: &str) -> Option<OwnedProcess> {
        self.inner.lock().ok()?.remove(id)
    }

    pub fn pid_of(&self, id: &str) -> Option<u32> {
        Some(self.inner.lock().ok()?.get(id)?.pid)
    }

    pub fn drain(&self) -> Vec<(String, OwnedProcess)> {
        match self.inner.lock() {
            Ok(mut owned) => owned.drain().collect(),
            Err(_) => Vec::new(),
        }
    }
}

pub fn file_name_of(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|name| name.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default()
}

/// Splits a stored command line on spaces, keeping quoted runs together.
pub fn split_args(args: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut quoted = false;

    for character in args.chars() {
        if character == '"' {
            quoted = !quoted;
            continue;
        }

        if character == ' ' && !quoted {
            if !current.is_empty() {
                parts.push(std::mem::take(&mut current));
            }

            continue;
        }

        current.push(character);
    }

    if !current.is_empty() {
        parts.push(current);
    }

    parts
}

#[cfg(windows)]
mod platform {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    use windows::core::Owned;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, TerminateProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE,
    };

    /// Keeps a console window from flashing up for console-subsystem tools.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    /// `CreateProcess` returns this for a program manifested as needing admin.
    const ERROR_ELEVATION_REQUIRED: i32 = 740;

    /// The user dismissed the consent dialog.
    const ERROR_CANCELLED: i32 = 1223;

    /// `OpenProcess` reports a pid that no longer exists this way.
    const ERROR_INVALID_PARAMETER: i32 = 87;

    /// Every running process as (lowercased exe name, pid).
    pub fn running_processes() -> Vec<(String, u32)> {
        let mut found = Vec::new();

        // SAFETY: value arguments only.
        let Ok(snapshot) = (unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }) else {
            return found;
        };

        // SAFETY: the snapshot was just created for us and nothing else holds it.
        let snapshot = unsafe { Owned::new(snapshot) };

        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        // SAFETY: the snapshot is live (owned above); `entry` is a local with
        // its required `dwSize` set.
        let mut has_entry = unsafe { Process32FirstW(*snapshot, &mut entry) }.is_ok();

        while has_entry {
            let length = entry
                .szExeFile
                .iter()
                .position(|character| *character == 0)
                .unwrap_or(entry.szExeFile.len());

            let name = String::from_utf16_lossy(&entry.szExeFile[..length]);

            found.push((name.to_ascii_lowercase(), entry.th32ProcessID));

            // SAFETY: as for `Process32FirstW` above.
            has_entry = unsafe { Process32NextW(*snapshot, &mut entry) }.is_ok();
        }

        found
    }

    /// A failed open means the process is gone or unreachable, which reads the
    /// same to the caller.
    pub fn is_alive(pid: u32) -> bool {
        // SAFETY: value arguments only.
        let Ok(handle) = (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) })
        else {
            return false;
        };

        // SAFETY: the handle was just opened for us; dropping the guard closes it.
        let _process = unsafe { Owned::new(handle) };

        true
    }

    pub fn spawn(path: &str, args: &[String]) -> Result<u32, String> {
        let working_directory = std::path::Path::new(path)
            .parent()
            .map(|dir| dir.to_path_buf());

        let mut command = Command::new(path);

        command.args(args).creation_flags(CREATE_NO_WINDOW);

        // Most rig tools read config files next to their executable and fail
        // in confusing ways when started from the overlay's own directory.
        if let Some(directory) = working_directory {
            command.current_dir(directory);
        }

        match command.spawn() {
            Ok(child) => Ok(child.id()),
            // Wheelbase tools — the Simagic daemon, Conspit Link — are
            // manifested `requireAdministrator`, and `CreateProcess` refuses
            // those outright rather than asking. Only the shell can raise the
            // consent dialog, so that failure is the one case worth a second
            // attempt through it.
            Err(error) if error.raw_os_error() == Some(ERROR_ELEVATION_REQUIRED) => {
                shell_execute(path, args)
            }
            Err(error) => Err(error.to_string()),
        }
    }

    /// Starts the program the way Explorer would: the manifest decides whether
    /// Windows asks for consent, so an ordinary program still starts silently.
    fn shell_execute(path: &str, args: &[String]) -> Result<u32, String> {
        use std::os::windows::ffi::OsStrExt;

        use windows::core::PCWSTR;
        use windows::Win32::System::Threading::GetProcessId;
        use windows::Win32::UI::Shell::{
            ShellExecuteExW, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
        };
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        let to_wide = |value: &str| -> Vec<u16> {
            std::ffi::OsStr::new(value)
                .encode_wide()
                .chain(std::iter::once(0))
                .collect()
        };

        // `split_args` took the quotes off; the shell takes a single string and
        // would split a path argument back apart at its spaces without them.
        let quoted: Vec<String> = args
            .iter()
            .map(|argument| quote_argument(argument))
            .collect();

        let file = to_wide(path);
        let parameters = to_wide(&quoted.join(" "));
        let directory = to_wide(
            &std::path::Path::new(path)
                .parent()
                .map(|dir| dir.to_string_lossy().to_string())
                .unwrap_or_default(),
        );

        let mut info = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            // Without this the handle needed to learn the pid is never filled,
            // and the launched program could not be tracked or closed.
            fMask: SEE_MASK_NOCLOSEPROCESS,
            lpFile: PCWSTR(file.as_ptr()),
            lpParameters: PCWSTR(parameters.as_ptr()),
            lpDirectory: PCWSTR(directory.as_ptr()),
            nShow: SW_SHOWNORMAL.0,
            ..Default::default()
        };

        // SAFETY: `info` and the wide strings it points into are locals that
        // outlive the call.
        unsafe { ShellExecuteExW(&mut info) }.map_err(|error| {
            if error.code().0 as u32 & 0xFFFF == ERROR_CANCELLED as u32 {
                "the elevation prompt was dismissed".to_string()
            } else {
                error.to_string()
            }
        })?;

        // SAFETY: `SEE_MASK_NOCLOSEPROCESS` hands the process handle to the
        // caller, who must close it; `Free` skips a null one.
        let process = unsafe { Owned::new(info.hProcess) };

        if process.is_invalid() {
            return Err("the program started without reporting a process".to_string());
        }

        // SAFETY: the handle is live (owned above).
        let pid = unsafe { GetProcessId(*process) };

        Ok(pid)
    }

    /// Wraps one argument the way `CommandLineToArgvW` reads it back: a quote
    /// is escaped, and the backslashes in front of one — including the run at
    /// the end that would otherwise escape the closing quote — are doubled.
    fn quote_argument(argument: &str) -> String {
        if !argument.is_empty() && !argument.contains([' ', '\t', '"']) {
            return argument.to_string();
        }

        let mut quoted = String::from('"');
        let mut backslashes = 0;

        for character in argument.chars() {
            if character == '\\' {
                backslashes += 1;

                continue;
            }

            if character == '"' {
                quoted.extend(std::iter::repeat_n('\\', backslashes * 2 + 1));
                backslashes = 0;
            } else {
                quoted.extend(std::iter::repeat_n('\\', backslashes));
                backslashes = 0;
            }

            quoted.push(character);
        }

        quoted.extend(std::iter::repeat_n('\\', backslashes * 2));
        quoted.push('"');

        quoted
    }

    pub fn terminate(pid: u32) -> Result<(), String> {
        // SAFETY: value arguments only.
        let handle = match unsafe { OpenProcess(PROCESS_TERMINATE, false, pid) } {
            Ok(handle) => handle,
            // The pid is gone — nothing left to close, which is what the
            // caller asked for. Every other failure, an elevated program
            // above all, refused us and must not read as closed.
            Err(error) if error.code().0 as u32 & 0xFFFF == ERROR_INVALID_PARAMETER as u32 => {
                return Ok(())
            }
            Err(error) => return Err(error.to_string()),
        };

        // SAFETY: the handle was just opened for us and nothing else holds it.
        let process = unsafe { Owned::new(handle) };

        // SAFETY: the handle is live (owned above) and opened for termination.
        unsafe { TerminateProcess(*process, 0) }.map_err(|error| error.to_string())
    }
}

#[cfg(not(windows))]
mod platform {
    pub fn running_processes() -> Vec<(String, u32)> {
        Vec::new()
    }

    pub fn is_alive(_pid: u32) -> bool {
        false
    }

    pub fn spawn(_path: &str, _args: &[String]) -> Result<u32, String> {
        Err("launching companion apps is only supported on Windows".to_string())
    }

    pub fn terminate(_pid: u32) -> Result<(), String> {
        Ok(())
    }
}

pub use platform::{is_alive, running_processes, spawn, terminate};

/// Ends every process running under this executable name, and reports how many
/// actually went away. Used only for the programs the user marked to close with
/// the app — everywhere else the pid we started is the limit.
pub fn terminate_by_name(executable: &str) -> usize {
    running_processes()
        .into_iter()
        .filter(|(name, _)| name == executable)
        .filter(|(_, pid)| terminate(*pid).is_ok())
        .count()
}
