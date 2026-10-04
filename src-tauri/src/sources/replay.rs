//! Tape playback and recording, both standing in for a live source.
//!
//! `ReplaySource` plays a tape at the pace it was recorded and then reports a
//! disconnect, so the runtime reconnects and the tape loops — a perf run sees
//! the reset path as well. `RecordingSource` wraps a live source and writes
//! what passes through it.
//!
//! Both are chosen by environment variable in `create_source`, dev builds only.

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tracing::{info, warn};

use crate::model::enums::SimType;
use crate::sources::iracing::session_parse::parse_session;
use crate::sources::source::{ParsedSession, SourceFrame, SourceReadResult, TelemetrySource};
use crate::sources::tape::{TapeHeader, TapeReader, TapeRecord, TapeWriter};
use crate::telemetry::capabilities::Capabilities;

/// Path of a tape to play instead of connecting to the sim.
pub const REPLAY_ENV: &str = "MARBLE_TRACE_REPLAY";
/// Directory to record every live connection into, one tape each.
pub const RECORD_ENV: &str = "MARBLE_TRACE_RECORD";

pub struct ReplaySource {
    reader: TapeReader,
    /// The frame read ahead of its time, waiting for its moment.
    upcoming: Option<(u64, SourceFrame)>,
    pending_session: Option<String>,
    started: Option<Instant>,
}

impl ReplaySource {
    pub fn open(path: &Path) -> std::io::Result<Self> {
        let reader = TapeReader::open(path)?;

        Ok(Self {
            reader,
            upcoming: None,
            pending_session: None,
            started: None,
        })
    }

    /// Reads up to the next frame, keeping the latest session seen on the way.
    fn read_ahead(&mut self) {
        while self.upcoming.is_none() {
            match self.reader.next_record() {
                Some(TapeRecord::Frame { at_ms, frame }) => self.upcoming = Some((at_ms, *frame)),
                Some(TapeRecord::Session { yaml }) => self.pending_session = Some(yaml),
                None => return,
            }
        }
    }
}

impl TelemetrySource for ReplaySource {
    fn sim_type(&self) -> SimType {
        self.reader.header().sim
    }

    fn capabilities(&self) -> Capabilities {
        Capabilities::all()
    }

    fn read_frame(&mut self, timeout_ms: u32) -> SourceReadResult<SourceFrame> {
        self.read_ahead();

        let Some((at_ms, _)) = &self.upcoming else {
            return SourceReadResult::Disconnected;
        };

        let now = Instant::now();
        let started = *self.started.get_or_insert(now);
        let due = started + Duration::from_millis(*at_ms);
        let timeout = Duration::from_millis(u64::from(timeout_ms));

        if due > now {
            let wait = due - now;

            if wait > timeout {
                std::thread::sleep(timeout);

                return SourceReadResult::NotReady;
            }

            std::thread::sleep(wait);
        }

        let Some((_, frame)) = self.upcoming.take() else {
            return SourceReadResult::Disconnected;
        };

        // A session recorded right after this frame belongs to this tick, as
        // it did live — read it now, or the runtime's first poll misses it.
        self.read_ahead();

        SourceReadResult::Frame(frame)
    }

    fn session_changed(&mut self) -> bool {
        self.pending_session.is_some()
    }

    fn poll_session(&mut self) -> Option<ParsedSession> {
        parse_session(&self.pending_session.take()?)
    }

    fn last_session_yaml(&self) -> Option<&str> {
        None
    }
}

pub struct RecordingSource {
    inner: Box<dyn TelemetrySource>,
    writer: TapeWriter,
    started: Option<Instant>,
}

impl RecordingSource {
    pub fn new(inner: Box<dyn TelemetrySource>, writer: TapeWriter) -> Self {
        Self {
            inner,
            writer,
            started: None,
        }
    }
}

impl TelemetrySource for RecordingSource {
    fn sim_type(&self) -> SimType {
        self.inner.sim_type()
    }

    fn capabilities(&self) -> Capabilities {
        self.inner.capabilities()
    }

    fn read_frame(&mut self, timeout_ms: u32) -> SourceReadResult<SourceFrame> {
        let result = self.inner.read_frame(timeout_ms);

        if let SourceReadResult::Frame(frame) = &result {
            let started = *self.started.get_or_insert_with(Instant::now);
            let at_ms = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);

            self.writer.push(TapeRecord::Frame {
                at_ms,
                frame: Box::new(frame.clone()),
            });
        }

        result
    }

    fn session_changed(&mut self) -> bool {
        self.inner.session_changed()
    }

    fn poll_session(&mut self) -> Option<ParsedSession> {
        let parsed = self.inner.poll_session();

        if let Some(yaml) = self.inner.last_session_yaml() {
            self.writer.push(TapeRecord::Session {
                yaml: yaml.to_string(),
            });
        }

        parsed
    }

    fn last_session_yaml(&self) -> Option<&str> {
        self.inner.last_session_yaml()
    }
}

/// The tape named by `MARBLE_TRACE_REPLAY`, if one is set. A tape that cannot
/// be opened is reported once per attempt and the live sim is used instead.
pub fn replay_from_env() -> Option<Box<dyn TelemetrySource>> {
    let path = PathBuf::from(std::env::var_os(REPLAY_ENV)?);

    match ReplaySource::open(&path) {
        Ok(source) => {
            info!("Replaying tape {}", path.display());

            Some(Box::new(source))
        }
        Err(error) => {
            warn!("Tape {} cannot be replayed: {error}", path.display());

            None
        }
    }
}

/// Wraps a live source in a recorder when `MARBLE_TRACE_RECORD` names a
/// directory; each connection gets a tape of its own.
pub fn record_if_requested(source: Box<dyn TelemetrySource>) -> Box<dyn TelemetrySource> {
    let Some(directory) = std::env::var_os(RECORD_ENV).map(PathBuf::from) else {
        return source;
    };

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default();
    let path = directory.join(format!("session-{stamp}.tape.jsonl.gz"));

    let opened = std::fs::create_dir_all(&directory)
        .and_then(|()| TapeWriter::create(&path, &TapeHeader::new(source.sim_type())));

    match opened {
        Ok(writer) => {
            info!("Recording telemetry to {}", path.display());

            Box::new(RecordingSource::new(source, writer))
        }
        Err(error) => {
            warn!("Tape {} cannot be recorded: {error}", path.display());

            source
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SESSION_YAML: &str = "WeekendInfo:\n TrackID: 42\n TrackDisplayName: Test Ring\n";

    fn temp_tape(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "marble-trace-replay-{name}-{}.tape.jsonl.gz",
            std::process::id()
        ))
    }

    fn frame_with_speed(speed: f32) -> SourceFrame {
        let mut frame = SourceFrame::default();
        frame.car_dynamics.speed = speed;

        frame
    }

    /// Fakes a live sim: hands out its frames, then disconnects.
    struct ScriptedSource {
        frames: Vec<SourceFrame>,
        yaml: Option<String>,
        session_due: bool,
    }

    impl TelemetrySource for ScriptedSource {
        fn sim_type(&self) -> SimType {
            SimType::IRacing
        }

        fn capabilities(&self) -> Capabilities {
            Capabilities::all()
        }

        fn read_frame(&mut self, _timeout_ms: u32) -> SourceReadResult<SourceFrame> {
            if self.frames.is_empty() {
                return SourceReadResult::Disconnected;
            }

            SourceReadResult::Frame(self.frames.remove(0))
        }

        fn session_changed(&mut self) -> bool {
            self.session_due
        }

        fn poll_session(&mut self) -> Option<ParsedSession> {
            self.session_due = false;
            self.yaml = Some(SESSION_YAML.into());

            parse_session(SESSION_YAML)
        }

        fn last_session_yaml(&self) -> Option<&str> {
            self.yaml.as_deref()
        }
    }

    fn record(path: &Path, frames: Vec<SourceFrame>) {
        let writer = TapeWriter::create(path, &TapeHeader::new(SimType::IRacing))
            .expect("tape opens for writing");
        let mut recorder = RecordingSource::new(
            Box::new(ScriptedSource {
                frames,
                yaml: None,
                session_due: true,
            }),
            writer,
        );

        // The runtime's order: read a frame, then poll the session on it.
        while let SourceReadResult::Frame(_) = recorder.read_frame(0) {
            if recorder.session_changed() {
                recorder.poll_session();
            }
        }
    }

    #[test]
    fn a_recorded_session_replays_frame_for_frame() {
        let path = temp_tape("frames");
        record(&path, vec![frame_with_speed(1.0), frame_with_speed(2.0)]);

        let mut replay = ReplaySource::open(&path).expect("tape replays");
        let mut speeds = Vec::new();

        while let SourceReadResult::Frame(frame) = replay.read_frame(1000) {
            speeds.push(frame.car_dynamics.speed);
        }

        std::fs::remove_file(&path).ok();

        assert_eq!(speeds, vec![1.0, 2.0]);
    }

    #[test]
    fn the_session_is_ready_on_the_tick_it_was_recorded_with() {
        let path = temp_tape("session");
        record(&path, vec![frame_with_speed(1.0), frame_with_speed(2.0)]);

        let mut replay = ReplaySource::open(&path).expect("tape replays");
        let first = replay.read_frame(1000);
        let changed = replay.session_changed();
        let parsed = replay.poll_session();
        let changed_after_poll = replay.session_changed();

        std::fs::remove_file(&path).ok();

        assert!(matches!(first, SourceReadResult::Frame(_)));
        assert!(changed, "the first tick sees the session recorded with it");
        assert_eq!(parsed.expect("YAML parses").snapshot.track_id, 42);
        assert!(!changed_after_poll);
    }

    #[test]
    fn a_frame_further_off_than_the_timeout_is_not_ready_yet() {
        let path = temp_tape("pacing");

        {
            let writer = TapeWriter::create(&path, &TapeHeader::new(SimType::IRacing))
                .expect("tape opens for writing");
            writer.push(TapeRecord::Frame {
                at_ms: 0,
                frame: Box::new(frame_with_speed(1.0)),
            });
            writer.push(TapeRecord::Frame {
                at_ms: 60_000,
                frame: Box::new(frame_with_speed(2.0)),
            });
        }

        let mut replay = ReplaySource::open(&path).expect("tape replays");
        let first = replay.read_frame(1);
        let second = replay.read_frame(1);

        std::fs::remove_file(&path).ok();

        assert!(matches!(first, SourceReadResult::Frame(_)));
        assert!(matches!(second, SourceReadResult::NotReady));
    }
}
