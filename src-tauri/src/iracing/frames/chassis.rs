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

use super::AllFieldsFrame;

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

impl From<&AllFieldsFrame> for ChassisFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        Self {
            lf_ride_height: f.lf_ride_height,
            rf_ride_height: f.rf_ride_height,
            lr_ride_height: f.lr_ride_height,
            rr_ride_height: f.rr_ride_height,
            lf_shock_defl: f.lf_shock_defl,
            rf_shock_defl: f.rf_shock_defl,
            lr_shock_defl: f.lr_shock_defl,
            rr_shock_defl: f.rr_shock_defl,
            lf_temp_cl: f.lf_temp_cl,
            lf_temp_cm: f.lf_temp_cm,
            lf_temp_cr: f.lf_temp_cr,
            rf_temp_cl: f.rf_temp_cl,
            rf_temp_cm: f.rf_temp_cm,
            rf_temp_cr: f.rf_temp_cr,
            lr_temp_cl: f.lr_temp_cl,
            lr_temp_cm: f.lr_temp_cm,
            lr_temp_cr: f.lr_temp_cr,
            rr_temp_cl: f.rr_temp_cl,
            rr_temp_cm: f.rr_temp_cm,
            rr_temp_cr: f.rr_temp_cr,
            lf_pressure: f.lf_pressure,
            rf_pressure: f.rf_pressure,
            lr_pressure: f.lr_pressure,
            rr_pressure: f.rr_pressure,
            lf_wear_l: f.lf_wear_l,
            lf_wear_m: f.lf_wear_m,
            lf_wear_r: f.lf_wear_r,
            rf_wear_l: f.rf_wear_l,
            rf_wear_m: f.rf_wear_m,
            rf_wear_r: f.rf_wear_r,
            lr_wear_l: f.lr_wear_l,
            lr_wear_m: f.lr_wear_m,
            lr_wear_r: f.lr_wear_r,
            rr_wear_l: f.rr_wear_l,
            rr_wear_m: f.rr_wear_m,
            rr_wear_r: f.rr_wear_r,
            lf_brake_temp: f.lf_brake_temp,
            rf_brake_temp: f.rf_brake_temp,
            lr_brake_temp: f.lr_brake_temp,
            rr_brake_temp: f.rr_brake_temp,
        }
    }
}
