use serde::{Deserialize, Serialize};

/// Which simulator is currently connected.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum SimType {
    IRacing,
}

/// Status payload emitted as `sim://status`.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SimStatus {
    pub status: String,
    pub sim: Option<SimType>,
}

/// What the drag reduction system is doing.
///
/// `DRS_Status` is a single int the SDK documents only as "Drag Reduction
/// System Status", with no value table. These four came out of a logged
/// practice session at Monza: the state machine runs
/// `Unavailable -> Armed -> Ready <-> Open -> Unavailable`, and pressing the
/// in-car toggle moves the car only between `Ready` and `Open` — a press in
/// `Unavailable` or `Armed` does nothing at all.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "PascalCase")]
pub enum DrsState {
    /// Outside a zone, or the rules do not allow it here.
    #[default]
    Unavailable,
    /// Past the detection point with the activation zone still ahead. The
    /// button does nothing yet.
    Armed,
    /// Inside the activation zone, flap closed — the press will land.
    Ready,
    /// Flap open.
    Open,
}

impl From<i32> for DrsState {
    fn from(v: i32) -> Self {
        match v {
            1 => Self::Armed,
            2 => Self::Ready,
            3 => Self::Open,
            // Zero is "no DRS here"; anything else is a value this decode has
            // never seen, and guessing at it would be worse than saying so.
            _ => Self::Unavailable,
        }
    }
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "PascalCase")]
pub enum TrackSurface {
    #[default]
    NotInWorld,
    OffTrack,
    InPitStall,
    AproachingPits,
    OnTrack,
}

impl From<i32> for TrackSurface {
    fn from(v: i32) -> Self {
        match v {
            0 => Self::OffTrack,
            1 => Self::InPitStall,
            2 => Self::AproachingPits,
            3 => Self::OnTrack,
            _ => Self::NotInWorld,
        }
    }
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "PascalCase")]
pub enum SessionState {
    #[default]
    Invalid,
    GetInCar,
    Warmup,
    ParadeLaps,
    Racing,
    Checkered,
    CoolDown,
}

impl From<i32> for SessionState {
    fn from(v: i32) -> Self {
        match v {
            1 => Self::GetInCar,
            2 => Self::Warmup,
            3 => Self::ParadeLaps,
            4 => Self::Racing,
            5 => Self::Checkered,
            6 => Self::CoolDown,
            _ => Self::Invalid,
        }
    }
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "PascalCase")]
pub enum Skies {
    #[default]
    Clear,
    PartlyCloudy,
    MostlyCloudy,
    Overcast,
}

impl From<i32> for Skies {
    fn from(v: i32) -> Self {
        match v {
            1 => Self::PartlyCloudy,
            2 => Self::MostlyCloudy,
            3 => Self::Overcast,
            _ => Self::Clear,
        }
    }
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum PitState {
    #[default]
    None,
    In,
    Stall,
    Exit,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PitTargetType {
    Pitbox,
    PitExit,
}
