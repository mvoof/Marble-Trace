//! Hotkey dispatch: every keyboard shortcut and controller button the user
//! bound, caught and acted on here rather than in a webview.
//!
//! A runtime layer beside `telemetry/` and `input/`. A sim action goes to the
//! telemetry thread, a view action straight to the overlays and the remote
//! screens, and only a settings action needs the main window — which owns the
//! settings it writes. So acting on the car does not depend on any webview
//! being alive, unpaused or fed the right frames.
//!
//! The overlay's drag and interact modes live here too: their keys are the most
//! pressed of all, and the state is the dispatcher's to hold rather than one
//! window's to broadcast.
//!
//! What it needs from the frontend arrives as commands: the binding map and the
//! context (the layout gate, the interact key's settings), both pushed by the
//! main window whenever they change.

pub mod commands;
mod dispatch;
mod modes;
mod runtime;

pub use runtime::{on_device_edge, HotkeyState};
