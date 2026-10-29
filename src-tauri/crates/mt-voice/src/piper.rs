//! Piper, run as its own process and kept alive between replies: loading a
//! voice takes longer than speaking a short line with it.
//!
//! In `--json-input` mode Piper reads one JSON object per line and, given an
//! `output_file`, writes the WAV there and prints its path once done — the
//! printed line is how a reply's end is known.
//!
//! Piper takes its paths as narrow strings, so a path through a user folder
//! with a Cyrillic name would not survive the trip. The process is started in
//! the voice folder and handed only paths relative to it, which are ASCII by
//! construction: catalog ids, cache hashes and sanitised custom voice names.

use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::thread;

use serde_json::json;

/// Windows `CREATE_NO_WINDOW`: no console flashes up behind the overlay.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const ESPEAK_DATA_DIR: &str = "espeak-ng-data";

/// What a Piper process is started with; a change of any of it restarts it.
#[derive(Debug, Clone, PartialEq)]
pub struct PiperSetup {
    /// The voice folder; every other path is relative to it.
    pub root: PathBuf,
    pub executable: PathBuf,
    pub model: PathBuf,
    /// Piper's `length_scale`: above 1 speaks slower, below faster.
    pub length_scale: f32,
}

pub struct Piper {
    setup: PiperSetup,
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl Piper {
    pub fn spawn(setup: PiperSetup) -> io::Result<Self> {
        let model = relative_to(&setup.root, &setup.model)?;
        let espeak_data = relative_to(&setup.root, &setup.executable)?
            .parent()
            .map(|engine| engine.join(ESPEAK_DATA_DIR))
            .unwrap_or_else(|| PathBuf::from(ESPEAK_DATA_DIR));
        let mut command = Command::new(&setup.executable);

        command
            .current_dir(&setup.root)
            .arg("--model")
            .arg(&model)
            .arg("--espeak_data")
            .arg(&espeak_data)
            .arg("--length_scale")
            .arg(setup.length_scale.to_string())
            .arg("--json-input")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;

            command.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = command.spawn()?;
        let (Some(stdin), Some(stdout), Some(stderr)) =
            (child.stdin.take(), child.stdout.take(), child.stderr.take())
        else {
            let _ = child.kill();

            return Err(io::Error::other("piper started without its pipes"));
        };

        // Piper logs every line it speaks; a pipe nobody reads fills up and
        // stalls it, so the log is drained into ours.
        let _ = thread::Builder::new()
            .name("piper-log".into())
            .spawn(move || {
                for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                    tracing::debug!(target: "mt_voice::piper", "{line}");
                }
            });

        Ok(Self {
            setup,
            child,
            stdin,
            stdout: BufReader::new(stdout),
        })
    }

    pub fn setup(&self) -> &PiperSetup {
        &self.setup
    }

    /// Speaks `text` into `output` (inside the voice folder) and returns once
    /// the file is written. An error means the process is gone: drop it and
    /// start another.
    pub fn synthesize(&mut self, text: &str, output: &Path) -> io::Result<()> {
        let relative = relative_to(&self.setup.root, output)?;
        let request = json!({
            "text": text,
            "output_file": relative.to_string_lossy(),
        });

        if let Some(folder) = output.parent() {
            std::fs::create_dir_all(folder)?;
        }

        writeln!(self.stdin, "{request}")?;
        self.stdin.flush()?;

        let mut line = String::new();

        if self.stdout.read_line(&mut line)? == 0 {
            return Err(io::Error::new(io::ErrorKind::UnexpectedEof, "piper exited"));
        }

        if output.is_file() {
            Ok(())
        } else {
            Err(io::Error::other(format!(
                "piper wrote no {}",
                relative.display()
            )))
        }
    }
}

impl Drop for Piper {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn relative_to(root: &Path, path: &Path) -> io::Result<PathBuf> {
    let relative = path.strip_prefix(root).map_err(|_| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{} is outside the voice folder", path.display()),
        )
    })?;

    if !relative.to_string_lossy().is_ascii() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("{} is not an ASCII path", relative.display()),
        ));
    }

    Ok(relative.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hands_piper_only_ascii_paths_inside_the_voice_folder() {
        let root = Path::new("C:/Users/Пользователь/voice");

        assert_eq!(
            relative_to(root, &root.join("cache/dmitri/ab12.wav")).unwrap(),
            PathBuf::from("cache/dmitri/ab12.wav")
        );
        assert!(relative_to(root, Path::new("D:/elsewhere/x.wav")).is_err());
        assert!(relative_to(root, &root.join("custom-voices/голос/голос.onnx")).is_err());
    }
}
