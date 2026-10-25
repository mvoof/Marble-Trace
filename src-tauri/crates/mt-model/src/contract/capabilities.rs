//! What the connected simulator can provide: backend-internal flags and the
//! payload emitted to the frontend on connection.

/// Which telemetry domains the connected simulator supports.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct CapabilitiesPayload {
    pub player_dynamics: bool,
    pub inputs: bool,
    pub chassis: bool,
    pub fuel: bool,
    pub weather_current: bool,
    pub weather_forecast: bool,
    pub standings: bool,
    pub relative: bool,
    pub radar: bool,
    pub sectors: bool,
}

bitflags::bitflags! {
    #[derive(Copy, Clone)]
    /// Backend-internal flags describing what a connected simulator can provide.
    pub struct Capabilities: u32 {
        const PLAYER_DYNAMICS   = 1 << 0;
        const INPUTS            = 1 << 1;
        const CHASSIS           = 1 << 2;
        const FUEL              = 1 << 3;
        const WEATHER_CURRENT   = 1 << 4;
        const WEATHER_FORECAST  = 1 << 5;
        const STANDINGS         = 1 << 6;
        const RELATIVE          = 1 << 7;
        const RADAR             = 1 << 8;
        const SECTORS           = 1 << 9;
    }
}

impl From<Capabilities> for CapabilitiesPayload {
    fn from(caps: Capabilities) -> Self {
        Self {
            player_dynamics: caps.contains(Capabilities::PLAYER_DYNAMICS),
            inputs: caps.contains(Capabilities::INPUTS),
            chassis: caps.contains(Capabilities::CHASSIS),
            fuel: caps.contains(Capabilities::FUEL),
            weather_current: caps.contains(Capabilities::WEATHER_CURRENT),
            weather_forecast: caps.contains(Capabilities::WEATHER_FORECAST),
            standings: caps.contains(Capabilities::STANDINGS),
            relative: caps.contains(Capabilities::RELATIVE),
            radar: caps.contains(Capabilities::RADAR),
            sectors: caps.contains(Capabilities::SECTORS),
        }
    }
}
