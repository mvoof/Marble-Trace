/// Performance counters reported by the sim itself.
///
/// The sim is the only honest source for its own frame rate: measuring it from
/// outside needs a present-time hook and admin rights, while these values come
/// free with every telemetry tick. They are what the FPS diagnostics runner
/// samples to compare overlay configurations.
///
/// All three are averaged by iRacing over one second, so emitting them faster
/// than 1 Hz would only repeat the same number.
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
use serde::{Deserialize, Serialize};

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SimPerfFrame {
    /// Average frames per second rendered by the sim.
    /// @see https://sajax.github.io/irsdkdocs/telemetry/framerate/
    pub frame_rate: Option<f32>,

    /// Percent of available time the GPU took, 1 second average.
    /// @see https://sajax.github.io/irsdkdocs/telemetry/gpuusage/
    pub gpu_usage: Option<f32>,

    /// Percent of available time the foreground thread took, 1 second average.
    /// @see https://sajax.github.io/irsdkdocs/telemetry/cpuusagefg/
    pub cpu_usage_fg: Option<f32>,
}
