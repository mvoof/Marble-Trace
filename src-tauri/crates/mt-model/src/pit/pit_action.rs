//! What the driver asks of the pit order by hand — a key or a click — named by
//! intent rather than spelled out as broadcasts.
//!
//! The order a press turns into depends on what the sim has checked right now
//! (the SDK has set and clear, never toggle), so it is worked out on the
//! telemetry thread against the frame it reads, in `computations::pit_actions`.
//! A window sends only the intent.

use serde::{Deserialize, Serialize};

/// One corner of the car, as the black box lists them.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TireCorner {
    Lf,
    Rf,
    Lr,
    Rr,
}

impl TireCorner {
    pub const ALL: [TireCorner; 4] = [Self::Lf, Self::Rf, Self::Lr, Self::Rr];
}

/// A manual change to the pit order.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PitAction {
    /// The whole stop as planned: the calculated fuel and four tires.
    ApplyPlanned,
    /// Unchecks everything.
    Clear,
    /// Clears the fuel, or orders the calculated amount.
    ToggleFuel,
    /// One step of `pitFuelAdjustStep` up from what the sim holds.
    FuelStepUp,
    FuelStepDown,
    /// An exact amount, in liters — the fuel bar on release.
    SetFuel {
        liters: f32,
    },
    ToggleAllTires,
    ToggleTire {
        corner: TireCorner,
    },
    /// The next compound the session lists, wrapping at the end.
    CycleCompound,
    ToggleFastRepair,
    ToggleWindshield,
}
