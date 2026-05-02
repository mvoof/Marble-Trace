//! Replay provider for IBT files

use std::path::Path;
use std::sync::Arc;
use tokio::time::{Duration, Interval, interval};
use tracing::{debug, info, trace};

use crate::ibt::IbtReader;
use crate::provider::Provider;
use crate::types::FramePacket;
use crate::{Result, TelemetryError, VariableSchema};

/// Replay provider that reads from IBT files
pub struct ReplayProvider {
    /// IBT file reader
    reader: IbtReader,

    /// Playback speed multiplier (1.0 = normal, 2.0 = double speed)
    speed: f64,

    /// Frame pacing interval
    interval: Interval,

    /// Cached schema
    schema: Arc<VariableSchema>,

    /// Native tick rate from IBT
    tick_rate: f64,
}

impl ReplayProvider {
    /// Create a new replay provider from an IBT file
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let reader = IbtReader::open(path)?;

        // Get metadata
        let total_frames = reader.total_frames();
        let tick_rate = reader.tick_rate();

        // Get the variable schema from the reader
        let schema = Arc::new(reader.variables().clone());

        info!("Opened IBT file: {} frames at {}Hz", total_frames, tick_rate);

        // Calculate frame interval for pacing
        let frame_interval = Duration::from_secs_f64(1.0 / tick_rate);
        let interval = interval(frame_interval);

        Ok(Self { reader, speed: 1.0, interval, schema, tick_rate })
    }

    /// Get the variable schema
    pub fn schema(&self) -> Arc<crate::VariableSchema> {
        Arc::clone(&self.schema)
    }

    /// Set playback speed
    pub fn set_speed(&mut self, speed: f64) {
        self.speed = speed.clamp(0.1, 10.0); // Clamp to reasonable range

        // Update interval based on new speed
        let frame_duration = Duration::from_secs_f64(1.0 / (self.tick_rate * self.speed));
        self.interval = interval(frame_duration);

        debug!("Playback speed set to {}x", self.speed);
    }

    /// Seek to a specific frame
    pub fn seek_to_frame(&mut self, frame: usize) -> Result<()> {
        let total_frames = self.reader.total_frames();
        if frame >= total_frames {
            return Err(TelemetryError::connection_failed(format!(
                "Cannot seek to frame {} (file has {} frames)",
                frame, total_frames
            )));
        }

        // IbtReader tracks position internally
        // We'll need to reset and read up to the target
        debug!("Seeking to frame {}", frame);
        Ok(())
    }

    /// Get current playback time in seconds
    pub fn current_time(&self) -> f64 {
        self.reader.current_frame() as f64 / self.tick_rate
    }

    /// Get total duration in seconds
    pub fn duration(&self) -> f64 {
        self.reader.total_frames() as f64 / self.tick_rate
    }
}

#[async_trait::async_trait]
impl Provider for ReplayProvider {
    async fn next_frame(&mut self) -> Result<Option<FramePacket>> {
        // Check if we've reached the end
        let total_frames = self.reader.total_frames();
        if self.reader.current_frame() >= total_frames {
            debug!("Reached end of replay");
            return Ok(None);
        }

        // Wait for next frame timing (pacing)
        self.interval.tick().await;

        // Read next frame data directly from IBT reader
        let (frame_data, tick, session_version) = match self.reader.read_next_frame()? {
            Some(data) => data,
            None => {
                debug!("No more frames from reader");
                return Ok(None);
            }
        };

        trace!(
            "Frame {}/{}: tick={}, session_version={}",
            self.reader.current_frame(),
            total_frames,
            tick,
            session_version
        );

        let packet = FramePacket::new(frame_data, tick, session_version, Arc::clone(&self.schema));

        Ok(Some(packet))
    }

    async fn session_yaml(&mut self, _version: u32) -> Result<Option<String>> {
        // Get cleaned YAML from IBT file
        // IBT files have static session info, version parameter is ignored
        self.reader.session_yaml()
    }

    fn tick_rate(&self) -> f64 {
        self.tick_rate
    }
}

/// Replay control handle for external control
pub struct ReplayController {
    speed: f64,
    paused: bool,
}

impl Default for ReplayController {
    fn default() -> Self {
        Self { speed: 1.0, paused: false }
    }
}

impl ReplayController {
    /// Create a new controller
    pub fn new() -> Self {
        Self::default()
    }

    /// Set playback speed
    pub fn set_speed(&mut self, speed: f64) {
        self.speed = speed;
    }

    /// Pause playback
    pub fn pause(&mut self) {
        self.paused = true;
    }

    /// Resume playback
    pub fn resume(&mut self) {
        self.paused = false;
    }

    /// Check if paused
    pub fn is_paused(&self) -> bool {
        self.paused
    }

    /// Get current speed
    pub fn speed(&self) -> f64 {
        self.speed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::Provider;
    use crate::test_utils;

    #[tokio::test]
    async fn test_replay_provider_session_yaml() {
        let ibt_file = test_utils::get_smallest_ibt_test_file().expect("No IBT test files found");

        let mut provider = ReplayProvider::new(&ibt_file).expect("Failed to create ReplayProvider");

        // Get session YAML
        let yaml = provider
            .session_yaml(0)
            .await
            .expect("Failed to get session YAML")
            .expect("Session YAML should be present");

        // Verify YAML is non-empty
        assert!(!yaml.is_empty(), "Session YAML should not be empty");

        // Verify YAML structure
        assert!(yaml.contains("WeekendInfo:"), "YAML should contain WeekendInfo");
        assert!(yaml.contains("SessionInfo:"), "YAML should contain SessionInfo");

        // Verify YAML is preprocessed (no control characters)
        for ch in yaml.chars() {
            assert!(
                !matches!(ch, '\x00'..='\x08' | '\x0B'..='\x0C' | '\x0E'..='\x1F'),
                "YAML should be preprocessed and contain no control characters"
            );
        }

        // Verify YAML can be parsed
        let session = crate::SessionInfo::parse(&yaml).expect("YAML should parse into SessionInfo");

        assert!(!session.weekend_info.track_name.is_empty());
        assert!(!session.session_info.sessions.is_empty());

        println!(
            "Provider returned valid session YAML for track: {}",
            session.weekend_info.track_name
        );
    }
}
