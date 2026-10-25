//! The window labels the backend addresses, declared once so the app that
//! creates the windows and the crates that emit to them cannot disagree.

/// The settings window: it owns the settings, and its close ends the app.
pub const MAIN_WINDOW_LABEL: &str = "main";

/// Overlay windows are created per monitor, labelled `overlay-<monitor>`.
pub const OVERLAY_LABEL_PREFIX: &str = "overlay-";
