//! Frontend-visible shape of a connected input device and its button edges.
//!
//! Bindings persist `id`, so it must be stable across replug and USB port
//! changes — see `input::identity` for how it is derived and re-matched.

/// A game controller the app can bind buttons from.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct InputDevice {
    /// Stable identity, used as the binding's `deviceId`.
    pub id: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub product_name: String,
    pub button_count: u32,
    /// False while the device is remembered but not currently attached.
    pub connected: bool,
}

/// One button edge. Only edges are emitted — never the held state per poll.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct InputButtonEvent {
    pub device_id: String,
    pub button: u32,
    pub pressed: bool,
}

/// Reported when a stored device is re-matched by vendor/product after its
/// DirectInput GUID changed, so the frontend can rewrite its bindings once.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct InputDeviceRemap {
    pub previous_id: String,
    pub next_id: String,
}

/// Answer to "here is what I remember, what is actually plugged in?".
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct InputDeviceResolution {
    /// Attached devices plus remembered-but-offline ones, so bindings for a
    /// device that is unplugged are shown greyed rather than disappearing.
    pub devices: Vec<InputDevice>,
    /// Ids the caller should rewrite in its stored bindings, at most once per
    /// device — see `input::identity`.
    pub remaps: Vec<InputDeviceRemap>,
}
