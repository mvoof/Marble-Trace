use serde::{Deserialize, Serialize};

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
