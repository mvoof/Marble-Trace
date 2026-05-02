//! Provider trait for data sources

use super::types::FramePacket;
use crate::Result;

/// Trait for telemetry data sources
///
/// Providers abstract over different data sources (live, replay, network)
/// and handle their own timing internally. The trait is designed for
/// simplicity - just three methods that cover all needs.
#[async_trait::async_trait]
pub trait Provider: Send + 'static {
    /// Get the next telemetry frame
    ///
    /// Returns:
    /// - `Ok(Some(packet))` - New frame available
    /// - `Ok(None)` - Stream ended (normal termination)
    /// - `Err(e)` - Error occurred
    ///
    /// Each provider handles timing internally:
    /// - Live: Waits on Windows events
    /// - Replay: Reads at playback speed
    /// - Network: Handles timeouts
    async fn next_frame(&mut self) -> Result<Option<FramePacket>>;

    /// Get cleaned session YAML for a specific version
    ///
    /// This is called when a session version change is detected.
    /// Returns preprocessed YAML ready for parsing at the Connection level.
    /// Providers should cache results when possible.
    ///
    /// Returns:
    /// - `Ok(Some(yaml))` - Cleaned YAML string ready for parsing
    /// - `Ok(None)` - No session data for this version
    /// - `Err(e)` - Error extracting/cleaning session YAML
    async fn session_yaml(&mut self, version: u32) -> Result<Option<String>>;

    /// Get the native tick rate in Hz
    ///
    /// This is the source frequency (e.g., 60Hz for live, varies for replays)
    fn tick_rate(&self) -> f64;
}
