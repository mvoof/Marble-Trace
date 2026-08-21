//! Normalized telemetry model — the only backend -> frontend contract.
//! Filled by sim sources, consumed by computations and the emitter.
//! Must not import tauri, kerb or any sim-specific module.

pub mod capabilities;
pub mod cars;
pub mod chat;
pub mod defaults;
pub mod enums;
pub mod environment;
pub mod events;
pub mod flags;
pub mod input;
pub mod lap_log;
pub mod pit_command;
pub mod player;
pub mod reference_lap;
pub mod relative;
pub mod remote;
pub mod session;
pub mod sim_perf;
pub mod track_shape;
pub mod ts_values;

/// Registers every contract type this module declares with specta.
///
/// Lives here rather than in `lib.rs` so a new type is declared and registered
/// in the same place — a type registered nowhere simply vanishes from
/// `bindings.ts`, which fails at the frontend rather than at the build.
#[cfg(feature = "dev")]
pub fn register_types(types: &mut specta::TypeCollection) {
    types
        .register::<capabilities::CapabilitiesPayload>()
        .register::<cars::CarIdxFrame>()
        .register::<cars::CarPositionsFrame>()
        .register::<enums::SimStatus>()
        .register::<enums::SimType>()
        .register::<enums::PitTargetType>()
        .register::<events::RemoteControlKind>()
        .register::<events::RemoteStreamKind>()
        .register::<environment::EnvironmentFrame>()
        .register::<environment::WeatherForecastEntry>()
        .register::<flags::RaceFlags>()
        .register::<input::InputDevice>()
        .register::<input::InputButtonEvent>()
        .register::<input::InputDeviceRemap>()
        .register::<input::InputDeviceResolution>()
        .register::<lap_log::LapLogFrame>()
        .register::<pit_command::PitCommandKind>()
        .register::<pit_command::PitCommandRequest>()
        .register::<player::CarDynamicsFrame>()
        .register::<player::CarInputsFrame>()
        .register::<player::CarStatusFrame>()
        .register::<player::ChassisFrame>()
        .register::<player::LapTimingFrame>()
        .register::<player::PitServiceFrame>()
        .register::<player::PitTargetFrame>()
        .register::<reference_lap::ReferenceLapData>()
        .register::<reference_lap::ReferenceLapSample>()
        .register::<reference_lap::TrackCondition>()
        .register::<relative::RelativeFrame>()
        .register::<remote::RemoteDevice>()
        .register::<remote::RemoteServerConfig>()
        .register::<remote::RemoteServerInfo>()
        .register::<session::SessionFrame>()
        .register::<session::SessionSnapshot>()
        .register::<sim_perf::SimPerfFrame>()
        .register::<track_shape::TrackPoint>()
        .register::<track_shape::TrackRecordingFrame>()
        .register::<track_shape::TrackShapePayload>();

    chat::register_types(types);
}
