//! Recorded telemetry tape: the adapted frame stream of a live session, kept
//! for replaying it at real-time pace when measuring performance.
//!
//! A tape is gzipped JSON lines. The first line is a [`TapeHeader`], every
//! further line one [`TapeRecord`]. Frames are stored as `SourceFrame` — what
//! the adapter produced, so a replay starts exactly where the emitter does —
//! while the session is stored as the sim's raw YAML and parsed again on
//! replay, so the parse stays in the loop being measured.
//!
//! Measurement only (ADR-0004): widget previews run on mocks, never on a tape.

use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Sender};
use std::thread::JoinHandle;

use flate2::read::MultiGzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use tracing::warn;

use crate::model::enums::SimType;
use crate::sources::source::SourceFrame;

/// Identifies the file as a tape, so a stray JSON-lines file is refused.
pub const TAPE_FORMAT: &str = "marble-trace-tape";
/// Bumped whenever a record's shape changes in a way older tapes cannot follow.
pub const TAPE_VERSION: u32 = 1;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TapeHeader {
    pub format: String,
    pub version: u32,
    pub sim: SimType,
}

impl TapeHeader {
    pub fn new(sim: SimType) -> Self {
        Self {
            format: TAPE_FORMAT.into(),
            version: TAPE_VERSION,
            sim,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum TapeRecord {
    /// One tick. `atMs` is the time since the first frame of the tape, which
    /// is what a replay paces itself by.
    #[serde(rename_all = "camelCase")]
    Frame { at_ms: u64, frame: Box<SourceFrame> },
    /// The session YAML the sim published, following the frame it was read on.
    Session { yaml: String },
}

/// Writes a tape on a thread of its own, so serialization and compression stay
/// off the telemetry loop that is recording.
pub struct TapeWriter {
    sender: Option<Sender<TapeRecord>>,
    worker: Option<JoinHandle<()>>,
}

impl TapeWriter {
    pub fn create(path: &Path, header: &TapeHeader) -> std::io::Result<Self> {
        let file = File::create(path)?;
        let mut sink = BufWriter::new(GzEncoder::new(file, Compression::default()));

        serde_json::to_writer(&mut sink, header)?;
        sink.write_all(b"\n")?;

        let (sender, receiver) = mpsc::channel::<TapeRecord>();
        let shown_path = path.display().to_string();

        let worker = std::thread::Builder::new()
            .name("tape-writer".into())
            .spawn(move || {
                for record in receiver {
                    let written = serde_json::to_writer(&mut sink, &record)
                        .map_err(std::io::Error::from)
                        .and_then(|()| sink.write_all(b"\n"));

                    if let Err(error) = written {
                        warn!("Tape {shown_path}: write failed, recording stopped: {error}");

                        return;
                    }
                }

                let finished = sink
                    .into_inner()
                    .map_err(|error| error.into_error())
                    .and_then(|encoder| encoder.finish())
                    .and_then(|mut file| file.flush());

                if let Err(error) = finished {
                    warn!("Tape {shown_path}: could not be finished: {error}");
                }
            })?;

        Ok(Self {
            sender: Some(sender),
            worker: Some(worker),
        })
    }

    pub fn push(&self, record: TapeRecord) {
        if let Some(sender) = &self.sender {
            // A failed send means the worker already stopped and said why.
            let _ = sender.send(record);
        }
    }
}

impl Drop for TapeWriter {
    /// Closes the channel and waits for the tail, so a tape is always a
    /// complete gzip stream once its writer is gone.
    fn drop(&mut self) {
        self.sender.take();

        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

/// Reads a tape record by record, never holding more than one in memory.
pub struct TapeReader {
    lines: std::io::Lines<BufReader<MultiGzDecoder<File>>>,
    header: TapeHeader,
    path: PathBuf,
    line_number: usize,
}

impl TapeReader {
    pub fn open(path: &Path) -> std::io::Result<Self> {
        let file = File::open(path)?;
        let mut lines = BufReader::new(MultiGzDecoder::new(file)).lines();

        let first = lines.next().ok_or_else(|| invalid_data("empty tape"))??;
        let header: TapeHeader = serde_json::from_str(&first)?;

        if header.format != TAPE_FORMAT || header.version != TAPE_VERSION {
            return Err(invalid_data(&format!(
                "not a v{TAPE_VERSION} tape: {} v{}",
                header.format, header.version
            )));
        }

        Ok(Self {
            lines,
            header,
            path: path.to_path_buf(),
            line_number: 1,
        })
    }

    pub fn header(&self) -> &TapeHeader {
        &self.header
    }

    /// The next record, or `None` at the end of the tape. A tape cut short by
    /// a killed recording ends at its last whole line; a line that does not
    /// parse is skipped with a warning rather than ending the replay.
    pub fn next_record(&mut self) -> Option<TapeRecord> {
        loop {
            let line = match self.lines.next()? {
                Ok(line) => line,
                Err(error) => {
                    warn!("Tape {}: ends early: {error}", self.path.display());

                    return None;
                }
            };

            self.line_number += 1;

            match serde_json::from_str(&line) {
                Ok(record) => return Some(record),
                Err(error) => warn!(
                    "Tape {}: line {} skipped: {error}",
                    self.path.display(),
                    self.line_number
                ),
            }
        }
    }
}

fn invalid_data(message: &str) -> std::io::Error {
    std::io::Error::new(std::io::ErrorKind::InvalidData, message.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_tape(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "marble-trace-{name}-{}.tape.jsonl.gz",
            std::process::id()
        ))
    }

    fn frame_with_speed(speed: f32) -> SourceFrame {
        let mut frame = SourceFrame::default();
        frame.car_dynamics.speed = speed;
        frame.car_idx.car_idx_lap_dist_pct = vec![0.25, -1.0, 0.5];

        frame
    }

    #[test]
    fn a_written_tape_reads_back_record_for_record() {
        let path = temp_tape("round-trip");
        let frames = [frame_with_speed(10.0), frame_with_speed(20.5)];

        {
            let writer = TapeWriter::create(&path, &TapeHeader::new(SimType::IRacing))
                .expect("tape opens for writing");

            writer.push(TapeRecord::Frame {
                at_ms: 0,
                frame: Box::new(frames[0].clone()),
            });
            writer.push(TapeRecord::Session {
                yaml: "WeekendInfo:\n TrackID: 1\n".into(),
            });
            writer.push(TapeRecord::Frame {
                at_ms: 16,
                frame: Box::new(frames[1].clone()),
            });
        }

        let mut reader = TapeReader::open(&path).expect("tape opens for reading");
        assert_eq!(reader.header(), &TapeHeader::new(SimType::IRacing));

        let records: Vec<TapeRecord> = std::iter::from_fn(|| reader.next_record()).collect();
        std::fs::remove_file(&path).ok();

        assert_eq!(records.len(), 3);

        let TapeRecord::Frame { at_ms, frame } = &records[2] else {
            panic!("third record is a frame");
        };
        assert_eq!(*at_ms, 16);
        assert_eq!(
            serde_json::to_value(frame.as_ref()).unwrap(),
            serde_json::to_value(&frames[1]).unwrap()
        );

        let TapeRecord::Session { yaml } = &records[1] else {
            panic!("second record is the session");
        };
        assert!(yaml.contains("TrackID: 1"));
    }

    #[test]
    fn a_file_that_is_not_a_tape_is_refused() {
        let path = temp_tape("not-a-tape");

        {
            let header = TapeHeader {
                format: "something-else".into(),
                version: TAPE_VERSION,
                sim: SimType::IRacing,
            };
            TapeWriter::create(&path, &header).expect("file opens for writing");
        }

        let opened = TapeReader::open(&path);
        std::fs::remove_file(&path).ok();

        assert!(opened.is_err());
    }
}
