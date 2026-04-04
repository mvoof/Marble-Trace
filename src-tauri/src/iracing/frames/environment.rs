/// Environment telemetry — weather and track conditions.
///
/// Contains ambient temperature and is extensible for future
/// weather data (track temp, wind, humidity, etc.)
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct EnvironmentFrame {
    /// Ambient air temperature in °C
    /// @see https://sajax.github.io/irsdkdocs/telemetry/airtemp/
    pub air_temp: Option<f32>,
}
