//! Remote widgets: an HTTP + WebSocket server that hands the overlay bundle
//! and the live telemetry to browsers on the local network, so a layout screen
//! can be rendered on a tablet next to the wheel.
//!
//! Layering follows the rest of the backend: this module reads `model/` types
//! and the assembled bundle, and never reaches into `sources/` or
//! `computations/`. Widget layout stays a frontend concern — the main window
//! publishes an opaque snapshot the server only caches and forwards.
pub mod commands;
pub mod hub;
pub mod mirror;
pub mod pages;
pub mod server;
