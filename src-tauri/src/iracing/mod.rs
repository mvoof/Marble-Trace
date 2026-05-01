/// iRacing telemetry module — all iRacing-specific data acquisition.
///
/// This module handles the complete lifecycle of iRacing data:
/// - **frames/** — domain-separated telemetry frame types (car dynamics, inputs,
///   status, lap timing, session state, environment)
/// - **service** — connection management, streaming, and Tauri event emission
///
/// ## Architecture
///
/// Telemetry data flows as:
/// ```text
/// iRacing shared memory
///   → pitwall AllFieldsFrame (single read)
///   → decompose into 6 domain frames
///   → emit as separate Tauri events to frontend
/// ```
///
/// Session YAML data flows as:
/// ```text
/// iRacing session string
///   → pitwall SessionInfo (parsed YAML)
///   → emit directly as Tauri event (types auto-generated via specta)
/// ```
///
/// ## Extending
///
/// To add new telemetry variables:
/// 1. Add field to `frames/mod.rs::AllFieldsFrame` with `#[field_name = "..."]`
/// 2. Add field to the appropriate domain frame struct
/// 3. Update the domain's `From<&AllFieldsFrame>` impl
///
/// @see https://sajax.github.io/irsdkdocs/telemetry/
/// @see https://sajax.github.io/irsdkdocs/yaml/
pub mod enums;
pub mod frames;
pub mod service;
pub mod weather_forecast;

pub use enums::{SessionState, Skies, TrackSurface};
pub use frames::{
    CarDynamicsFrame, CarIdxFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, EnvironmentFrame,
    LapTimingFrame, SessionFrame,
};
pub use service::{
    get_last_session_info, set_pit_warning_laps, start_telemetry_stream, stop_telemetry_stream,
    ComputationState, TelemetryServiceState, TelemetryState,
};
pub use weather_forecast::WeatherForecastEntry;
