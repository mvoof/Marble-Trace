//! Frontend-visible capabilities payload emitted on connection.

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
