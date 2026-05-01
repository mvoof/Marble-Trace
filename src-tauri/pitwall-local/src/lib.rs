//! Modern, type-safe Rust library for iRacing telemetry data.
//!
//! We Race Pitwall provides high-performance access to iRacing's telemetry system
//! with first-class support for multiple application architectures.
//!
//! # Features
//!
//! - **Live Telemetry**: Real-time streaming from iRacing on Windows
//! - **Type Safety**: Compile-time validation with derive macros
//! - **Cross-platform IBT**: File analysis on any platform
//! - **Performance**: <1ms latency, 60Hz updates
//!
//! # Quick Start
//!
//! See the examples directory for complete usage demonstrations.
//!
//! ## Example (IBT replay)
//!
//! ```rust,no_run
//! use pitwall::{Pitwall, UpdateRate, PitwallFrame};
//! use futures::StreamExt;
//!
//! #[derive(PitwallFrame, Debug)]
//! struct CarData {
//!     #[field_name = "Speed"]
//!     speed: f32,
//! }
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     let connection = Pitwall::open("/path/to/session.ibt").await?;
//!     let mut stream = connection.subscribe::<CarData>(UpdateRate::Native);
//!
//!     while let Some(frame) = stream.next().await {
//!         println!("Speed: {}", frame.speed);
//!     }
//!     Ok(())
//! }
//! ```

// Core types and error handling
pub mod adapters;
mod dynamic_frame;
mod error;
#[cfg_attr(any(test, feature = "benchmark"), path = "test_utils.rs")]
#[cfg(any(test, feature = "benchmark"))]
pub mod test_utils;
pub mod types;
mod yaml_utils;

// Stream-based telemetry architecture
pub mod connection;
pub mod driver;
pub mod provider;
pub mod providers;
pub mod stream;

// Data source modules
pub mod ibt;
pub mod schema;

// Platform-specific modules
#[cfg(windows)]
pub mod windows;

// Core exports
pub use adapters::*;
pub use dynamic_frame::*;
pub use error::*;
pub use types::*;

// Data source exports
pub use ibt::IbtReader;

// Schema exports
pub use schema::{SessionInfo, SessionInfoParser};

// Windows memory exports
#[cfg(windows)]
pub use windows::{Connection as WindowsConnection, WaitResult};

// Main API exports
pub use types::UpdateRate;

pub use connection::live::LiveConnection;
pub use connection::replay::ReplayConnection;

// Re-export derive macros when available
#[cfg(feature = "derive")]
pub use pitwall_derive::PitwallFrame;

/// Unified entry point for Pitwall telemetry connections.
///
/// This factory provides a consistent API for creating connections to both
/// live iRacing telemetry and IBT file replay.
///
/// # Examples
///
/// ## Live Telemetry (Windows)
/// ```rust,no_run
/// use pitwall::Pitwall;
///
/// #[tokio::main]
/// async fn main() -> pitwall::Result<()> {
///     let connection = Pitwall::connect().await?;
///     // Use connection...
///     Ok(())
/// }
/// ```
///
/// ## IBT File Replay (Cross-platform)
/// ```rust,no_run
/// use pitwall::Pitwall;
///
/// #[tokio::main]
/// async fn main() -> pitwall::Result<()> {
///     let connection = Pitwall::open("session.ibt").await?;
///     // Use connection...
///     Ok(())
/// }
/// ```
pub struct Pitwall;

impl Pitwall {
    /// Connect to live iRacing telemetry.
    ///
    /// Establishes a connection to iRacing's shared memory on Windows.
    /// This method waits for iRacing to be running and telemetry to be available.
    ///
    /// # Platform
    ///
    /// This method is only available on Windows where iRacing runs.
    /// On other platforms, this method returns an `UnsupportedPlatform` error.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Platform is not Windows
    /// - iRacing is not running
    /// - Shared memory is not accessible
    /// - Connection timeout is reached
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use pitwall::Pitwall;
    ///
    /// # #[tokio::main]
    /// # async fn main() -> pitwall::Result<()> {
    /// let connection = Pitwall::connect().await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn connect() -> Result<LiveConnection> {
        LiveConnection::connect().await
    }

    /// Open an IBT file for replay.
    ///
    /// Loads an iRacing telemetry file (IBT) and provides a connection that behaves
    /// identically to live telemetry, including frame streaming and session info access.
    ///
    /// # Arguments
    ///
    /// * `path` - Path to the IBT file
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - File does not exist or is not readable
    /// - File is not a valid IBT format
    /// - File header is corrupted
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use pitwall::Pitwall;
    ///
    /// # #[tokio::main]
    /// # async fn main() -> pitwall::Result<()> {
    /// let connection = Pitwall::open("race.ibt").await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn open<P: AsRef<std::path::Path>>(path: P) -> Result<ReplayConnection> {
        ReplayConnection::open(path).await
    }
}
