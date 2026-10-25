//! Hotkey dispatch: every keyboard shortcut and controller button the user
//! bound, caught and acted on in the backend rather than in a webview.
//!
//! `dispatch` and `modes` decide what a press fires; `runtime` carries it out.
//! The app hands it a `HotkeyHost`: the OS's global shortcuts behind
//! `KeyRegistrar`, the sink, the telemetry service and the remote hub.
//!
//! What it needs from the frontend arrives as commands: the binding map and the
//! context (the layout gate, the interact key's settings), both pushed by the
//! main window whenever they change.

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

pub mod dispatch;
pub mod modes;
pub mod runtime;
mod utils;
