use serde_repr::{Deserialize_repr, Serialize_repr};

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize_repr, Deserialize_repr, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(i32)]
pub enum TrackSurface {
    #[default]
    NotInWorld = -1,
    OffTrack = 0,
    InPitStall = 1,
    AproachingPits = 2,
    OnTrack = 3,
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
#[derive(Serialize_repr, Deserialize_repr, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(i32)]
pub enum SessionState {
    #[default]
    Invalid = 0,
    GetInCar = 1,
    Warmup = 2,
    ParadeLaps = 3,
    Racing = 4,
    Checkered = 5,
    CoolDown = 6,
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
#[derive(Serialize_repr, Deserialize_repr, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(i32)]
pub enum Skies {
    #[default]
    Clear = 0,
    PartlyCloudy = 1,
    MostlyCloudy = 2,
    Overcast = 3,
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
