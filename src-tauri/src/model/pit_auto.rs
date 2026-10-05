//! Auto pit mode — the strategy the frontend pushes in, the overrides it sends
//! with a manual order, and the state the widget reads back.
//!
//! The decisions themselves live in `computations::pit_auto` and run on the
//! telemetry thread, so an order goes out whether or not any window is alive
//! to watch it happen.

use serde::{Deserialize, Serialize};

/// The rules auto mode builds an order by: the pit strategy from the app
/// settings, plus whether the pit service widget is in the active layout — auto
/// mode never acts for a widget the driver removed.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PitAutoConfig {
    pub auto_fuel: bool,
    pub auto_tires: bool,
    /// Remaining tread, in percent, at or below which a corner is changed.
    pub tire_wear_threshold_pct: f32,
    pub widget_on_screen: bool,
}

/// Which halves of the stop a manual order takes away from auto mode.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PitClaim {
    pub fuel: bool,
    pub tires: bool,
}

/// What the header plate says: which parts of the stop auto mode will still
/// decide. `Off` while auto mode is switched off in the settings or the widget
/// is not on screen.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum PitAutoMode {
    #[default]
    Off,
    Auto,
    FuelAuto,
    TireAuto,
    Manual,
}

/// Auto mode's state as the widget shows it, on the 4 Hz tier.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PitAutoFrame {
    pub mode: PitAutoMode,
    /// Counts every order auto mode has put out this connection. The widget
    /// reveals itself on a step of it, the way it does after a key press.
    pub orders_sent: u32,
    /// Whether the last of those reached the sim's broadcast channel; `None`
    /// before the first.
    pub last_order_ok: Option<bool>,
}
