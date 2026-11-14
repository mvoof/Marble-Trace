//! iRacing's `app.ini`: whether it writes a telemetry file each time the driver
//! gets in the car (`irsdkAutoLogDisk`), and switching that on.
//!
//! The file is edited as bytes: it is not always UTF-8, and every other line,
//! comment and alignment stays as the sim wrote it. iRacing rewrites the file
//! when it closes, so an edit made while it runs is lost.

use std::fs;
use std::path::Path;

use mt_model::app::stats::AutologState;

const AUTOLOG_KEY: &[u8] = b"irsdkAutoLogDisk=";
const ON: &[u8] = b"1";
const OFF: &[u8] = b"0";

/// The setting as the file at `path` holds it.
pub fn read_autolog(path: &Path) -> AutologState {
    match fs::read(path) {
        Ok(bytes) => autolog_state(&bytes),
        Err(_) => AutologState::Unknown,
    }
}

/// Writes `irsdkAutoLogDisk=1` into the file at `path`; the state it holds after.
pub fn enable_autolog(path: &Path) -> Result<AutologState, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    let Some(enabled) = with_autolog_on(&bytes) else {
        return Ok(autolog_state(&bytes));
    };

    fs::write(path, &enabled).map_err(|error| error.to_string())?;

    Ok(autolog_state(&enabled))
}

fn autolog_state(bytes: &[u8]) -> AutologState {
    match value_span(bytes).map(|(start, end)| &bytes[start..end]) {
        Some(ON) => AutologState::On,
        Some(OFF) => AutologState::Off,
        _ => AutologState::Unknown,
    }
}

/// The file with the setting's value turned to `1`; `None` when there is
/// nothing to change — no such setting, or it is on already.
fn with_autolog_on(bytes: &[u8]) -> Option<Vec<u8>> {
    let (start, end) = value_span(bytes)?;

    if &bytes[start..end] == ON {
        return None;
    }

    let mut enabled = Vec::with_capacity(bytes.len());
    enabled.extend_from_slice(&bytes[..start]);
    enabled.extend_from_slice(ON);
    enabled.extend_from_slice(&bytes[end..]);

    Some(enabled)
}

/// Where the setting's value lies: from after `=` to the first blank, `;` or
/// line end. The key counts only at the start of a line.
fn value_span(bytes: &[u8]) -> Option<(usize, usize)> {
    let mut line_start = 0;

    for line in bytes.split(|byte| *byte == b'\n') {
        if line.starts_with(AUTOLOG_KEY) {
            let start = line_start + AUTOLOG_KEY.len();
            let value_length = line[AUTOLOG_KEY.len()..]
                .iter()
                .take_while(|byte| !matches!(byte, b' ' | b'\t' | b';' | b'\r'))
                .count();

            return Some((start, start + value_length));
        }

        line_start += line.len() + 1;
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    const OFF_FILE: &[u8] = b"[Misc]\r\nirsdkAutoLog=0\r\nirsdkAutoLogDisk=0                      \t; Automatically log\r\nirsdkEnableDisk=1\r\n";

    #[test]
    fn the_setting_is_read_at_a_line_start_only() {
        assert_eq!(autolog_state(OFF_FILE), AutologState::Off);
        assert_eq!(
            autolog_state(b"[Misc]\nirsdkAutoLogDisk=1\n"),
            AutologState::On
        );
        assert_eq!(
            autolog_state(b"; xirsdkAutoLogDisk=1\n"),
            AutologState::Unknown
        );
        assert_eq!(autolog_state(b""), AutologState::Unknown);
    }

    #[test]
    fn enabling_changes_the_value_and_nothing_else() {
        let enabled = with_autolog_on(OFF_FILE).unwrap();

        assert_eq!(
            enabled,
            b"[Misc]\r\nirsdkAutoLog=0\r\nirsdkAutoLogDisk=1                      \t; Automatically log\r\nirsdkEnableDisk=1\r\n"
        );
        assert_eq!(with_autolog_on(&enabled), None);
    }

    #[test]
    fn a_file_without_the_setting_is_left_alone() {
        assert_eq!(with_autolog_on(b"[Misc]\nirsdkEnableDisk=1\n"), None);
    }

    #[test]
    fn the_file_on_disk_is_switched_on() {
        let folder = std::env::temp_dir().join(format!("mt-app-ini-{}", std::process::id()));
        fs::create_dir_all(&folder).unwrap();
        let path = folder.join("app.ini");
        fs::write(&path, OFF_FILE).unwrap();

        assert_eq!(read_autolog(&path), AutologState::Off);
        assert_eq!(enable_autolog(&path), Ok(AutologState::On));
        assert_eq!(read_autolog(&path), AutologState::On);
        assert_eq!(
            read_autolog(&folder.join("missing.ini")),
            AutologState::Unknown
        );

        fs::remove_dir_all(&folder).unwrap();
    }
}
