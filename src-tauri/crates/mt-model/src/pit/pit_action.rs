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

/// Which corners a stop changes, named outright rather than flipped one by one.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct TireSet {
    pub lf: bool,
    pub rf: bool,
    pub lr: bool,
    pub rr: bool,
}

impl TireSet {
    pub const ALL: TireSet = TireSet {
        lf: true,
        rf: true,
        lr: true,
        rr: true,
    };
    pub const NONE: TireSet = TireSet {
        lf: false,
        rf: false,
        lr: false,
        rr: false,
    };

    /// The names `named` takes.
    pub const NAMES: &'static [&'static str] = &[
        "all", "front", "rear", "left", "right", "lf", "rf", "lr", "rr",
    ];

    /// The name of a set the voice packs can say, `None` for any other.
    pub fn name(self) -> Option<&'static str> {
        Self::NAMES
            .iter()
            .copied()
            .find(|name| Self::named(name) == Some(self))
    }

    /// A set by the name the voice packs give it: all, front, rear, left,
    /// right, or one corner — lf, rf, lr, rr.
    pub fn named(name: &str) -> Option<Self> {
        let of = |corners: &[TireCorner]| {
            let mut set = Self::NONE;

            for corner in corners {
                match corner {
                    TireCorner::Lf => set.lf = true,
                    TireCorner::Rf => set.rf = true,
                    TireCorner::Lr => set.lr = true,
                    TireCorner::Rr => set.rr = true,
                }
            }

            set
        };

        match name {
            "all" => Some(Self::ALL),
            "front" => Some(of(&[TireCorner::Lf, TireCorner::Rf])),
            "rear" => Some(of(&[TireCorner::Lr, TireCorner::Rr])),
            "left" => Some(of(&[TireCorner::Lf, TireCorner::Lr])),
            "right" => Some(of(&[TireCorner::Rf, TireCorner::Rr])),
            "lf" => Some(of(&[TireCorner::Lf])),
            "rf" => Some(of(&[TireCorner::Rf])),
            "lr" => Some(of(&[TireCorner::Lr])),
            "rr" => Some(of(&[TireCorner::Rr])),
            _ => None,
        }
    }

    pub fn contains(self, corner: TireCorner) -> bool {
        match corner {
            TireCorner::Lf => self.lf,
            TireCorner::Rf => self.rf,
            TireCorner::Lr => self.lr,
            TireCorner::Rr => self.rr,
        }
    }
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
    /// An exact amount, in liters — the fuel bar on release. Zero clears it.
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
    /// The calculated fuel, ordered whatever the sim holds — the toggle's set
    /// half, for a voice command that must not clear what it means to order.
    PlannedFuel,
    /// Exactly these corners: the rest are unchecked, an empty set clears all.
    SetTires {
        corners: TireSet,
    },
    /// A compound by the sim's own index; one the session does not list is
    /// refused.
    SetCompound {
        index: i32,
    },
    SetFastRepair {
        on: bool,
    },
    SetWindshield {
        on: bool,
    },
}
