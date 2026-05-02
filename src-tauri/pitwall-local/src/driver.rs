//! Driver spawns and manages telemetry processing tasks

use std::sync::Arc;
use tokio::sync::watch;
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, trace, warn};

use super::provider::Provider;
use super::types::FramePacket;
use crate::SessionInfo;

/// Result of spawning driver tasks
pub struct DriverChannels {
    /// Receiver for telemetry frames
    pub frames: watch::Receiver<Option<Arc<FramePacket>>>,
    /// Receiver for session info updates
    pub sessions: watch::Receiver<Option<Arc<SessionInfo>>>,
    /// Cancellation token for graceful shutdown
    pub cancel: CancellationToken,
}

/// Driver spawns and manages telemetry processing tasks
///
/// Spawns a frame reader task that owns the Provider and detects session changes.
/// YAML parsing happens in short-lived spawned tasks to maintain <1ms frame latency.
pub struct Driver;

impl Driver {
    /// Spawn driver tasks for the given provider
    ///
    /// Returns watch receivers for frames and sessions, plus a cancellation token
    /// for graceful shutdown.
    pub fn spawn<P>(provider: P) -> DriverChannels
    where
        P: Provider,
    {
        // Create the communication channels
        let (frame_tx, frame_rx) = watch::channel(None);
        let (session_tx, session_rx) = watch::channel(None);

        // Create cancellation token for coordinated shutdown
        let cancel = CancellationToken::new();

        // Clone what we need for the frame reader task
        let cancel_frame = cancel.clone();

        // Spawn frame reader task (owns the provider)
        // YAML parsing happens via short-lived spawned tasks (see frame_reader_task)
        tokio::spawn(async move {
            Self::frame_reader_task(provider, frame_tx, session_tx, cancel_frame).await;
        });

        DriverChannels { frames: frame_rx, sessions: session_rx, cancel }
    }

    /// Frame reader task - reads frames and detects session changes
    async fn frame_reader_task<P>(
        mut provider: P,
        frame_tx: watch::Sender<Option<Arc<FramePacket>>>,
        session_tx: watch::Sender<Option<Arc<SessionInfo>>>,
        cancel: CancellationToken,
    ) where
        P: Provider,
    {
        info!("Frame reader task started");
        let mut frame_count = 0u64;
        let mut error_count = 0u32;
        let mut last_session_version = None;
        const MAX_ERRORS: u32 = 10;

        loop {
            // Check for cancellation between frames
            if cancel.is_cancelled() {
                info!("Frame reader cancelled");
                break;
            }

            // Use select to allow cancellation during provider.next_frame()
            let result = tokio::select! {
                _ = cancel.cancelled() => {
                    info!("Frame reader cancelled during read");
                    break;
                }
                result = provider.next_frame() => result,
            };

            match result {
                Ok(Some(packet)) => {
                    frame_count += 1;
                    error_count = 0; // Reset error count on success
                    let version = packet.session_version;

                    trace!(
                        "Frame {}: tick={}, session_version={}",
                        frame_count, packet.tick, version
                    );

                    // Detect session version change
                    if last_session_version != Some(version) {
                        debug!(
                            "Session version changed: {} -> {}",
                            last_session_version.unwrap_or(0),
                            version
                        );

                        // Fetch YAML and spawn short-lived task to parse it
                        // This avoids blocking frame processing while YAML parsing happens
                        match provider.session_yaml(version).await {
                            Ok(Some(yaml)) => {
                                debug!(
                                    "Fetched session YAML ({} bytes) for version {}",
                                    yaml.len(),
                                    version
                                );

                                // Clone session_tx for the spawned task
                                let session_tx_clone = session_tx.clone();

                                // Spawn detached task to parse YAML without blocking frame reader
                                // Task automatically cleans up when parsing completes (~1-10ms)
                                tokio::spawn(async move {
                                    match SessionInfo::parse(&yaml) {
                                        Ok(session) => {
                                            debug!(
                                                "Session parsed: Track={}",
                                                session.weekend_info.track_name
                                            );
                                            let _ = session_tx_clone.send(Some(Arc::new(session)));
                                        }
                                        Err(e) => {
                                            warn!("Failed to parse session YAML: {}", e);
                                        }
                                    }
                                });
                            }
                            Ok(None) => {
                                debug!("No session YAML for version {}", version);
                            }
                            Err(e) => {
                                warn!("Failed to get session YAML: {}", e);
                            }
                        }

                        last_session_version = Some(version);
                    }

                    // Always send the frame
                    if frame_tx.send(Some(Arc::new(packet))).is_err() {
                        debug!("Frame receiver dropped, shutting down");
                        break;
                    }
                }
                Ok(None) => {
                    info!("Provider stream ended after {} frames", frame_count);
                    // Send None to indicate end of stream
                    let _ = frame_tx.send(None);
                    let _ = session_tx.send(None);
                    break;
                }
                Err(e) => {
                    // Provider error - don't crash on transient failures
                    error_count += 1;
                    error!("Provider error ({}/{}): {}", error_count, MAX_ERRORS, e);

                    if error_count >= MAX_ERRORS {
                        error!("Too many provider errors, shutting down");
                        let _ = frame_tx.send(None);
                        let _ = session_tx.send(None);
                        break;
                    }

                    // Exponential backoff: 50ms, 100ms, 200ms, ...
                    let backoff = std::time::Duration::from_millis(50 * (1 << error_count.min(5)));
                    tokio::time::sleep(backoff).await;
                }
            }
        }

        info!("Frame reader task ended (processed {} frames)", frame_count);
    }
}
