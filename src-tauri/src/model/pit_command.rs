//! Pit service orders sent back into the sim — the frontend half of the
//! contract, named rather than numbered.
//!
//! The wire codes live in `kerb::iracing::broadcast`; `sources/iracing` maps
//! these variants onto them. The sim only accepts orders while the driver is
//! sitting in the car.

use serde::{Deserialize, Serialize};

/// A single pit checkbox the sim should toggle.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PitCommandKind {
    Clear,
    Windshield,
    /// `value` = liters to add; 0 keeps the amount already ordered.
    Fuel,
    /// `value` = pressure in kPa; 0 keeps the pressure already ordered.
    Lf,
    Rf,
    Lr,
    Rr,
    ClearTires,
    FastRepair,
    ClearWindshield,
    ClearFastRepair,
    ClearFuel,
    TireCompound,
}

/// One entry of a pit order. `value` is ignored by commands that take no
/// parameter.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct PitCommandRequest {
    pub kind: PitCommandKind,
    #[serde(default)]
    pub value: i32,
}
