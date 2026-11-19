//! Piper, run as its own process and kept alive between replies: loading a
//! voice takes longer than speaking a short line with it.
//!
//! A small Python API worker keeps one voice loaded. Rust sends one JSON
//! object per line; the worker writes the requested WAV and returns a JSON
//! response when synthesis is complete.
//!
//! Piper takes its paths as narrow strings, so a path through a user folder
//! with a Cyrillic name would not survive the trip. The process is started in
//! the voice folder and handed only paths relative to it, which are ASCII by
//! construction: catalog ids, cache hashes and sanitised custom voice names.

use std::io::{self, BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::thread;

use serde::Deserialize;
use serde_json::json;

/// Windows `CREATE_NO_WINDOW`: no console flashes up behind the overlay.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Piper 1.5's JSON protocol was removed from its CLI. Keep the voice loaded
/// in a small Python API worker and use JSON lines between the Rust thread and
/// that process instead.
const PIPER_SERVICE: &str = r#"
import json
import sys
import wave

sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")

try:
    from piper import PiperVoice, SynthesisConfig

    voice = PiperVoice.load(sys.argv[1])
    synthesis = SynthesisConfig(length_scale=float(sys.argv[2]))
    print(json.dumps({"ready": True}), flush=True)
except Exception as error:
    print(json.dumps({"error": str(error)}), flush=True)
    raise SystemExit(1)

for line in sys.stdin:
    try:
        request = json.loads(line)
        with wave.open(request["output_file"], "wb") as wav_file:
            voice.synthesize_wav(request["text"], wav_file, syn_config=synthesis)
        print(json.dumps({"output_file": request["output_file"]}), flush=True)
    except Exception as error:
        print(json.dumps({"error": str(error)}), flush=True)
"#;

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

#[derive(Deserialize)]
struct PiperResponse {
    ready: Option<bool>,
    output_file: Option<String>,
    error: Option<String>,
}

impl Piper {
    pub fn spawn(setup: PiperSetup) -> io::Result<Self> {
        let model = relative_to(&setup.root, &setup.model)?;
        let mut command = Command::new(&setup.executable);

        command
            .current_dir(&setup.root)
            .arg("-X")
            .arg("utf8")
            .arg("-u")
            .arg("-c")
            .arg(PIPER_SERVICE)
            .arg(&model)
            .arg(setup.length_scale.to_string())
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

        let mut stdout = BufReader::new(stdout);
        let mut line = String::new();

        if stdout.read_line(&mut line)? == 0 {
            let status = child.wait().ok();

            return Err(io::Error::other(format!(
                "piper exited during startup ({status:?})"
            )));
        }

        let response: PiperResponse = match serde_json::from_str(&line) {
            Ok(response) => response,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();

                return Err(io::Error::other(format!(
                    "invalid piper startup response: {error}"
                )));
            }
        };

        if let Some(error) = response.error {
            let _ = child.wait();

            return Err(io::Error::other(error));
        }

        if response.ready != Some(true) {
            let _ = child.kill();
            let _ = child.wait();

            return Err(io::Error::other("piper did not become ready"));
        }

        Ok(Self {
            setup,
            child,
            stdin,
            stdout,
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

        let response: PiperResponse = serde_json::from_str(&line)
            .map_err(|error| io::Error::other(format!("invalid piper response: {error}")))?;

        if let Some(error) = response.error {
            let _ = std::fs::remove_file(output);

            return Err(io::Error::other(error));
        }

        if response.output_file.is_some() && output.is_file() {
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
