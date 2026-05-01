use serde_repr::{Deserialize_repr, Serialize_repr};
use specta::Type;

#[derive(Serialize_repr, Deserialize_repr, Type, Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum TrackSurface {
    NotInWorld = -1,
    OffTrack = 0,
    InPitStall = 1,
    AproachingPits = 2,
    OnTrack = 3,
}

impl Default for TrackSurface {
    fn default() -> Self {
        Self::NotInWorld
    }
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

#[derive(Serialize_repr, Deserialize_repr, Type, Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum SessionState {
    Invalid = 0,
    GetInCar = 1,
    Warmup = 2,
    ParadeLaps = 3,
    Racing = 4,
    Checkered = 5,
    CoolDown = 6,
}

impl Default for SessionState {
    fn default() -> Self {
        Self::Invalid
    }
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

#[derive(Serialize_repr, Deserialize_repr, Type, Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum Skies {
    Clear = 0,
    PartlyCloudy = 1,
    MostlyCloudy = 2,
    Overcast = 3,
}

impl Default for Skies {
    fn default() -> Self {
        Self::Clear
    }
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
