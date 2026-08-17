//! Remote-widgets contract: what the settings UI needs to know about the
//! server that serves layout screens to devices on the LAN.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct RemoteServerInfo {
    pub running: bool,
    /// LAN address of this machine — what a tablet has to be pointed at.
    /// `localhost` here means no usable network interface was found.
    pub ip: String,
    /// The port actually bound, which can differ from the requested one when
    /// that was taken.
    pub port: u16,
    /// Empty when the server runs without a token, i.e. open to the network.
    pub token: String,
    /// False when the server is bound to loopback and only the host can reach it.
    pub lan: bool,
    pub client_count: u32,
}

/// What a connected device says about itself.
///
/// Reported, never obeyed: the layout is drawn against the bounds stored with
/// the screen, because the editor has to work with the device switched off.
/// This only lets the settings UI offer to match the two up.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct RemoteDevice {
    /// Screen slug the device is showing.
    pub slug: String,
    /// Page area actually available, in CSS pixels — smaller than the screen
    /// while a browser address bar is on top of it.
    pub viewport_width: u32,
    pub viewport_height: u32,
    /// The device's own screen, which is what the user recognises.
    pub screen_width: u32,
    pub screen_height: u32,
    pub pixel_ratio: f32,
    /// True while the page runs without browser chrome, where the viewport and
    /// the screen finally agree.
    pub standalone: bool,
    pub connected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct RemoteServerConfig {
    pub port: u16,
    pub lan: bool,
    /// Empty disables the check. The frontend generates and persists it.
    pub token: String,
    /// Frames per second pushed to browsers, clamped to 1..=60 by the hub.
    pub telemetry_hz: u32,
    /// Resolved app language, for the few pages the server renders itself.
    pub language: String,
}
