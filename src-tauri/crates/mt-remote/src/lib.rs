//! Remote widgets: an HTTP + WebSocket server that hands the overlay bundle
//! and the live telemetry to browsers on the local network, so a layout screen
//! can be rendered on a tablet next to the wheel.
//!
//! Layering follows the rest of the backend: this module reads `model/` types
//! and the assembled bundle, and never reaches into `sources/` or
//! `computations/`. Widget layout stays a frontend concern — the main window
//! publishes an opaque snapshot the server only caches and forwards.

// The app's lint block (`src-tauri/src/lib.rs` says why it is not in `[lints]`).
#![deny(unsafe_op_in_unsafe_fn)]
#![deny(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::undocumented_unsafe_blocks,
    clippy::missing_safety_doc
)]
#![warn(clippy::multiple_unsafe_ops_per_block)]

mod utils;

pub mod control;
pub mod csp;
pub mod hub;
pub mod pages;
pub mod server;
