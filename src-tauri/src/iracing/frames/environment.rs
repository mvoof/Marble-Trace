/// Environment telemetry — weather and track conditions.
///
/// Contains ambient temperature and is extensible for future
/// weather data (track temp, wind, humidity, etc.)
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::iracing::enums::Skies;

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct EnvironmentFrame {
    /// Ambient air temperature in °C
    /// @see https://sajax.github.io/irsdkdocs/telemetry/airtemp/
    pub air_temp: Option<f32>,

    /// Track surface temperature in °C
    /// @see https://sajax.github.io/irsdkdocs/telemetry/tracktemp/
    pub track_temp: Option<f32>,

    /// Wind velocity in m/s
    /// @see https://sajax.github.io/irsdkdocs/telemetry/windvel/
    pub wind_vel: Option<f32>,

    /// Wind direction in radians
    /// @see https://sajax.github.io/irsdkdocs/telemetry/winddir/
    pub wind_dir: Option<f32>,

    /// Relative humidity (0.0 to 1.0)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/relativehumidity/
    pub relative_humidity: Option<f32>,

    /// Skies (0=clear, 1=partly cloudy, 2=mostly cloudy, 3=overcast)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/skies/
    pub skies: Option<Skies>,

    /// Current amount of precipitation at start/finish (0.0 to 1.0)
    pub precipitation: Option<f32>,

    /// Estimate of overall track wetness (0=dry to 7=flooded)
    pub track_wetness: Option<i32>,

    /// Whether rain tires are officially allowed
    pub weather_declared_wet: Option<bool>,

    /// Weather dynamics (Constant vs Dynamic)
    pub weather_type: Option<i32>,

    /// Weather system version
    pub weather_version: Option<i32>,
}
