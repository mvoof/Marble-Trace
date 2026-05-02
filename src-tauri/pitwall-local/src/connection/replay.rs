//! Replay connection for IBT files

use futures::{Stream, StreamExt};
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tokio_stream::wrappers::WatchStream;
use tokio_util::sync::CancellationToken;
use tracing::{debug, info, warn};

use crate::driver::Driver;
use crate::provider::Provider;
use crate::providers::replay::ReplayProvider;
use crate::stream::ThrottleExt;
use crate::types::{FramePacket, UpdateRate};
use crate::{FrameAdapter, Result, SessionInfo, VariableSchema};

/// Replay connection from IBT file
pub struct ReplayConnection {
    /// Frame watch receiver
    frames: watch::Receiver<Option<Arc<FramePacket>>>,

    /// Session watch receiver
    sessions: watch::Receiver<Option<Arc<SessionInfo>>>,

    /// Variable schema
    schema: Arc<VariableSchema>,

    /// Source frequency
    source_hz: f64,

    /// Cancellation token for stopping tasks
    cancel: CancellationToken,
}

impl ReplayConnection {
    /// Open an IBT file for replay.
    ///
    /// Waits for the first frame to be available before returning to ensure
    /// the connection is fully initialized and ready for subscriptions.
    pub async fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        let path = path.as_ref();
        info!("Opening IBT file: {}", path.display());

        // Create provider and extract metadata
        let provider = ReplayProvider::new(path)?;
        let schema = provider.schema();
        let source_hz = provider.tick_rate();

        // Spawn driver tasks
        let channels = Driver::spawn(provider);

        // Wait for first frame to be available
        let mut frame_rx = channels.frames.clone();
        let timeout = std::time::Duration::from_secs(5);
        let wait_result = tokio::time::timeout(timeout, async {
            loop {
                frame_rx.changed().await.ok();
                if frame_rx.borrow().is_some() {
                    break;
                }
            }
        })
        .await;

        if wait_result.is_err() {
            warn!("Timeout waiting for first frame from replay file");
        }

        info!("Replay connection opened ({}Hz)", source_hz);

        Ok(Self {
            frames: channels.frames,
            sessions: channels.sessions,
            schema,
            source_hz,
            cancel: channels.cancel,
        })
    }

    /// Subscribe to telemetry frames
    pub fn subscribe<T>(&self, rate: UpdateRate) -> impl Stream<Item = T> + 'static
    where
        T: FrameAdapter + Send + 'static,
    {
        // Validate schema once at subscription time
        let validation = T::validate_schema(&self.schema).expect("Schema validation failed");

        // Create base frame stream from watch channel
        let frames = WatchStream::new(self.frames.clone()).filter_map(|opt| async move { opt });

        // Apply rate control and adaptation
        let effective_rate = rate.normalize(self.source_hz);

        match effective_rate {
            UpdateRate::Native => {
                // Direct adaptation, no throttling
                frames.map(move |packet| T::adapt(&packet, &validation)).boxed()
            }
            UpdateRate::Max(hz) => {
                // Throttle then adapt
                let interval = Duration::from_secs_f64(1.0 / hz as f64);
                frames.throttle(interval).map(move |packet| T::adapt(&packet, &validation)).boxed()
            }
        }
    }

    /// Get session updates as a stream
    pub fn session_updates(&self) -> impl Stream<Item = Arc<SessionInfo>> + 'static {
        // Simply watch the session channel - Driver handles all the complexity!
        WatchStream::new(self.sessions.clone()).filter_map(|opt| async move { opt })
    }

    /// Get current session info (if available)
    pub fn current_session(&self) -> Option<Arc<SessionInfo>> {
        self.sessions.borrow().clone()
    }

    /// Get the source telemetry frequency
    pub fn source_hz(&self) -> f64 {
        self.source_hz
    }

    /// Get the variable schema
    pub fn schema(&self) -> &VariableSchema {
        &self.schema
    }
}

impl Drop for ReplayConnection {
    fn drop(&mut self) {
        debug!("Dropping replay connection");
        // Cancel tasks on drop for clean shutdown
        self.cancel.cancel();
    }
}
