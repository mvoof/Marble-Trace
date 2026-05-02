/// Car input telemetry — driver pedal input data.
///
/// Contains throttle, brake, and clutch pedal positions.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
use serde::{Deserialize, Serialize};
use specta::Type;

use super::AllFieldsFrame;

#[derive(Serialize, Deserialize, Type, Debug, Clone)]
pub struct CarInputsFrame {
    /// Throttle pedal position: 0.0 (released) to 1.0 (fully pressed)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/throttle/
    pub throttle: f32,

    /// Brake pedal position: 0.0 (released) to 1.0 (fully pressed)
    /// @see https://sajax.github.io/irsdkdocs/telemetry/brake/
    pub brake: f32,

    /// Clutch pedal: 0.0 = disengaged (pedal pressed), 1.0 = engaged (pedal released).
    /// Note: iRacing provides clutch engagement, not pedal input.
    /// @see https://sajax.github.io/irsdkdocs/telemetry/clutch/
    pub clutch: Option<f32>,
}

impl From<&AllFieldsFrame> for CarInputsFrame {
    fn from(f: &AllFieldsFrame) -> Self {
        Self {
            throttle: f.throttle,
            brake: f.brake,
            clutch: f.clutch,
        }
    }
}
