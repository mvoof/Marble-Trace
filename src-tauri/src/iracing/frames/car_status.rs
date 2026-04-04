/// Car status telemetry — vehicle systems, fuel, engine, and pit state.
///
/// Contains fuel levels, engine temperatures, voltage, oil pressure,
/// and pit road / on track indicators.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct CarStatusFrame {
    /// Fuel level in liters
    /// @see https://sajax.github.io/irsdkdocs/telemetry/fuellevel/
    pub fuel_level: f32,

    /// Fuel level as percentage: 0.0 to 1.0
    /// @see https://sajax.github.io/irsdkdocs/telemetry/fuellevelpct/
    pub fuel_level_pct: Option<f32>,

    /// Fuel consumption rate in kg/h
    /// @see https://sajax.github.io/irsdkdocs/telemetry/fueluseperhour/
    pub fuel_use_per_hour: Option<f32>,

    /// Engine oil temperature in °C
    /// @see https://sajax.github.io/irsdkdocs/telemetry/oiltemp/
    pub oil_temp: f32,

    /// Engine oil pressure in kPa
    /// @see https://sajax.github.io/irsdkdocs/telemetry/oilpress/
    pub oil_press: Option<f32>,

    /// Engine water temperature in °C
    /// @see https://sajax.github.io/irsdkdocs/telemetry/watertemp/
    pub water_temp: f32,

    /// Electrical system voltage
    /// @see https://sajax.github.io/irsdkdocs/telemetry/voltage/
    pub voltage: Option<f32>,

    /// Whether car is on pit road
    /// @see https://sajax.github.io/irsdkdocs/telemetry/onpitroad/
    pub on_pit_road: Option<bool>,

    /// Whether car is on track (not in garage/pits)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/isontrack/
    pub is_on_track: Option<bool>,

    /// Proximity indicator bit field for cars nearby
    /// @see https://sajax.github.io/irsdkdocs/telemetry/carleftright/
    pub car_left_right: Option<i32>,
}
