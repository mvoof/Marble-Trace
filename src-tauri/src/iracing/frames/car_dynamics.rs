/// Car dynamics telemetry — high-frequency vehicle motion data.
///
/// Contains speed, RPM, gear, steering, velocity vectors, acceleration,
/// orientation, and shift timing indicators.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
use serde::{Deserialize, Serialize};

use super::AllFieldsFrame;

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CarDynamicsFrame {
    /// Vehicle speed in meters/sec
    /// @see https://sajax.github.io/irsdkdocs/telemetry/speed/
    pub speed: f32,

    /// Engine revolutions per minute
    /// @see https://sajax.github.io/irsdkdocs/telemetry/rpm/
    pub rpm: f32,

    /// Current gear: -1=Reverse, 0=Neutral, 1..n=Forward
    /// @see https://sajax.github.io/irsdkdocs/telemetry/gear/
    pub gear: i32,

    /// Steering wheel angle in radians
    /// @see https://sajax.github.io/irsdkdocs/telemetry/steeringwheelangle/
    pub steering_wheel_angle: f32,

    /// Vehicle velocity along X axis (lateral) in m/s
    /// @see https://sajax.github.io/irsdkdocs/telemetry/velocityx/
    pub velocity_x: Option<f32>,

    /// Vehicle velocity along Y axis (vertical) in m/s
    /// @see https://sajax.github.io/irsdkdocs/telemetry/velocityy/
    pub velocity_y: Option<f32>,

    /// Vehicle velocity along Z axis (forward) in m/s
    /// @see https://sajax.github.io/irsdkdocs/telemetry/velocityz/
    pub velocity_z: Option<f32>,

    /// Lateral acceleration in m/s²
    /// @see https://sajax.github.io/irsdkdocs/telemetry/lataccel/
    pub lat_accel: Option<f32>,

    /// Longitudinal acceleration in m/s²
    /// @see https://sajax.github.io/irsdkdocs/telemetry/longaccel/
    pub long_accel: Option<f32>,

    /// Yaw angle (heading) in radians
    /// @see https://sajax.github.io/irsdkdocs/telemetry/yaw/
    pub yaw: Option<f32>,

    /// Yaw rate (rotation speed) in rad/s
    /// @see https://sajax.github.io/irsdkdocs/telemetry/yawrate/
    pub yaw_rate: Option<f32>,

    /// Pitch angle in radians
    /// @see https://sajax.github.io/irsdkdocs/telemetry/pitch/
    pub pitch: Option<f32>,

    /// Roll angle in radians
    /// @see https://sajax.github.io/irsdkdocs/telemetry/roll/
    pub roll: Option<f32>,

    /// Shift indicator: 0.0 (idle) to 1.0 (shift now)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/shiftindicatorpct/
    pub shift_indicator_pct: Option<f32>,

    /// RPM at which grinding occurs during shift
    /// @see https://sajax.github.io/irsdkdocs/telemetry/shiftgrindrpm/
    pub shift_grind_rpm: Option<f32>,
}
impl From<&AllFieldsFrame> for CarDynamicsFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        Self {
            speed: f.speed,
            rpm: f.rpm,
            gear: f.gear,
            steering_wheel_angle: f.steering_wheel_angle,
            velocity_x: f.velocity_x,
            velocity_y: f.velocity_y,
            velocity_z: f.velocity_z,
            lat_accel: f.lat_accel,
            long_accel: f.long_accel,
            yaw: f.yaw,
            yaw_rate: f.yaw_rate,
            pitch: f.pitch,
            roll: f.roll,
            shift_indicator_pct: f.shift_indicator_pct,
            shift_grind_rpm: f.shift_grind_rpm,
        }
    }
}
