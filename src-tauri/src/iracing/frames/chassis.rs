/// Chassis telemetry — per-wheel tire and suspension data.
///
/// Contains ride height, shock deflection, tire temperatures (3 zones),
/// tire pressure, tire wear, and brake disc temperatures for all 4 corners.
///
/// All distance values are in meters (convert to mm on the frontend).
/// All temperature values are in °C. Pressure in kPa. Wear in 0.0–1.0.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct ChassisFrame {
    // === Ride Height (meters) ===
    pub lf_ride_height: Option<f32>,
    pub rf_ride_height: Option<f32>,
    pub lr_ride_height: Option<f32>,
    pub rr_ride_height: Option<f32>,

    // === Shock Deflection (meters) ===
    pub lf_shock_defl: Option<f32>,
    pub rf_shock_defl: Option<f32>,
    pub lr_shock_defl: Option<f32>,
    pub rr_shock_defl: Option<f32>,

    // === Tire Temperatures °C (inner / middle / outer) ===
    pub lf_temp_cl: Option<f32>,
    pub lf_temp_cm: Option<f32>,
    pub lf_temp_cr: Option<f32>,
    pub rf_temp_cl: Option<f32>,
    pub rf_temp_cm: Option<f32>,
    pub rf_temp_cr: Option<f32>,
    pub lr_temp_cl: Option<f32>,
    pub lr_temp_cm: Option<f32>,
    pub lr_temp_cr: Option<f32>,
    pub rr_temp_cl: Option<f32>,
    pub rr_temp_cm: Option<f32>,
    pub rr_temp_cr: Option<f32>,

    // === Tire Pressure (kPa) ===
    pub lf_pressure: Option<f32>,
    pub rf_pressure: Option<f32>,
    pub lr_pressure: Option<f32>,
    pub rr_pressure: Option<f32>,

    // === Tire Wear (0.0–1.0, inner / middle / outer) ===
    pub lf_wear_l: Option<f32>,
    pub lf_wear_m: Option<f32>,
    pub lf_wear_r: Option<f32>,
    pub rf_wear_l: Option<f32>,
    pub rf_wear_m: Option<f32>,
    pub rf_wear_r: Option<f32>,
    pub lr_wear_l: Option<f32>,
    pub lr_wear_m: Option<f32>,
    pub lr_wear_r: Option<f32>,
    pub rr_wear_l: Option<f32>,
    pub rr_wear_m: Option<f32>,
    pub rr_wear_r: Option<f32>,

    // === Brake Disc Temperature (°C) ===
    pub lf_brake_temp: Option<f32>,
    pub rf_brake_temp: Option<f32>,
    pub lr_brake_temp: Option<f32>,
    pub rr_brake_temp: Option<f32>,
}
