//! Live telemetry provider for Windows

use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, info, trace, warn};

use crate::provider::Provider;
use crate::types::FramePacket;
use crate::windows::{Connection, WaitResult};
use crate::yaml_utils;
use crate::{Result, VariableSchema};

/// Live provider that reads from iRacing shared memory
#[cfg(windows)]
pub struct LiveProvider {
    /// Windows shared memory connection
    connection: Connection,

    /// Cached variable schema
    schema: Arc<VariableSchema>,
}

#[cfg(windows)]
impl LiveProvider {
    /// Create a new live provider
    pub fn new() -> Result<Self> {
        let connection = Connection::try_connect()?;

        // Log current connection status (might be stale memory)
        if !connection.is_connected() {
            warn!(
                "Shared memory mapped but iRacing not actively running - will wait for session to start"
            );
        }

        let header = connection.header();
        info!(
            sdk_version = header.ver,
            tick_rate = header.tick_rate,
            num_vars = header.num_vars,
            status_connected = connection.is_connected(),
            "Connected to iRacing shared memory"
        );

        // Build schema from variables
        let variables = connection.get_variables();
        let mut variable_map = std::collections::HashMap::new();

        for var_info in variables {
            variable_map.insert(var_info.name.clone(), var_info);
        }

        let frame_size = header.buf_len as usize;
        let schema = Arc::new(VariableSchema::new(variable_map, frame_size)?);

        Ok(Self { connection, schema })
    }

    /// Get the variable schema
    pub fn schema(&self) -> Arc<VariableSchema> {
        Arc::clone(&self.schema)
    }
}

#[cfg(windows)]
#[async_trait::async_trait]
impl Provider for LiveProvider {
    async fn next_frame(&mut self) -> Result<Option<FramePacket>> {
        // Track how long we've been waiting without a connection
        let mut no_connection_count = 0u32;
        const MAX_NO_CONNECTION_ATTEMPTS: u32 = 600; // 5 minutes at 500ms intervals

        // Loop until we get a frame
        // This matches the C++ SDK pattern of persistent checking
        loop {
            // Check if still connected (like C++ SDK checks status)
            if !self.connection.is_connected() {
                no_connection_count += 1;

                // Log periodically to avoid spam
                if no_connection_count == 1 {
                    info!("Waiting for iRacing to start a session...");
                } else if no_connection_count % 20 == 0 {
                    debug!(
                        "Still waiting for iRacing session ({}s elapsed)",
                        no_connection_count / 2
                    );
                }

                // Give up after extended period with no connection
                if no_connection_count >= MAX_NO_CONNECTION_ATTEMPTS {
                    warn!("Giving up after 5 minutes without iRacing session");
                    return Ok(None);
                }

                // Wait a bit before checking again
                tokio::time::sleep(Duration::from_millis(500)).await;
                continue;
            }

            // Reset counter when we get a connection
            if no_connection_count > 0 {
                info!("iRacing session detected, resuming telemetry");
                no_connection_count = 0;
            }

            // Try to get data BEFORE waiting (C++ SDK pattern)
            // This catches frames that arrived since our last check
            if let Some(data) = self.connection.get_new_data() {
                let frame_data = data.to_vec();
                let header = self.connection.header();
                let latest_buf_idx = self.connection.find_latest_buffer(header);
                let tick = header.var_buf[latest_buf_idx].tick_count as u32;
                let session_version = header.session_info_update as u32;

                trace!(
                    "Frame: tick={}, session_version={}, size={}",
                    tick,
                    session_version,
                    frame_data.len()
                );

                return Ok(Some(FramePacket::new(
                    frame_data,
                    tick,
                    session_version,
                    Arc::clone(&self.schema),
                )));
            }

            // No data yet, wait for signal (cooperative async)
            const TIMEOUT: Duration = Duration::from_millis(500);

            match self.connection.wait_for_update_async(TIMEOUT).await? {
                WaitResult::Signaled => {
                    // Event fired, loop back to check for data
                    // The event might be for session info or a frame we haven't
                    // seen yet due to tick count not changing
                    trace!("Event signaled, checking for new data");
                    continue;
                }
                WaitResult::Timeout => {
                    // No event within timeout, but keep trying
                    // Live streams don't end unless disconnected
                    trace!("Wait timeout, continuing to poll");
                    continue;
                }
            }
        }
    }

    async fn session_yaml(&mut self, _version: u32) -> Result<Option<String>> {
        debug!("Fetching session YAML from shared memory");

        // Get raw YAML from shared memory
        let raw_yaml = match self.connection.session_info() {
            Some(yaml) => yaml,
            None => {
                debug!("No session info available");
                return Ok(None);
            }
        };

        // Return None if empty
        if raw_yaml.trim().is_empty() {
            return Ok(None);
        }

        // Preprocess to fix iRacing's YAML issues
        let cleaned_yaml = yaml_utils::preprocess_iracing_yaml(&raw_yaml)?;

        info!("Extracted session YAML ({} bytes)", cleaned_yaml.len());

        Ok(Some(cleaned_yaml))
    }

    fn tick_rate(&self) -> f64 {
        self.connection.header().tick_rate as f64
    }
}
