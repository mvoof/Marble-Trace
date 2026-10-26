//! Normalized telemetry model — the only backend -> frontend contract.
//! Filled by sim sources, consumed by computations and the emitter.
//! Must not import tauri, kerb or any sim-specific module.

pub mod app;
pub mod computed;
pub mod contract;
pub mod pit;
pub mod sim;
pub mod utils;

/// Registers every contract type this crate declares with specta.
///
/// Lives here rather than in the app's `bindings.rs` so a new type is declared
/// and registered in the same crate — a type registered nowhere simply vanishes from
/// `bindings.ts`, which fails at the frontend rather than at the build.
#[cfg(feature = "dev")]
pub fn register_types(types: &mut specta::TypeCollection) {
    types
        .register::<contract::capabilities::CapabilitiesPayload>()
        .register::<sim::cars::CarIdxFrame>()
        .register::<sim::cars::CarPositionsFrame>()
        .register::<sim::cars::PacingFrame>()
        .register::<sim::radio::RadioFrame>()
        .register::<sim::radio::RadioTransmission>()
        .register::<sim::radio::RadioChannel>()
        .register::<sim::radio::RadioFrequencyEntry>()
        .register::<contract::client_protocol::ClientEnvelope>()
        .register::<contract::client_protocol::RejectedCommand>()
        .register::<app::companions::CompanionApp>()
        .register::<app::companions::CompanionStatus>()
        .register::<app::companions::DetectedApp>()
        .register::<sim::enums::SimStatus>()
        .register::<sim::enums::SimType>()
        .register::<sim::enums::PitTargetType>()
        .register::<sim::enums::DrsState>()
        .register::<contract::events::RemoteControlKind>()
        .register::<contract::events::RemoteStreamKind>()
        .register::<sim::environment::EnvironmentFrame>()
        .register::<sim::environment::WeatherForecastEntry>()
        .register::<sim::flags::RaceFlags>()
        .register::<app::hotkeys::Binding>()
        .register::<app::hotkeys::HotkeyActionSpec>()
        .register::<app::hotkeys::HotkeyContext>()
        .register::<app::hotkeys::HotkeyKind>()
        .register::<app::hotkeys::HotkeySettingsAction>()
        .register::<app::hotkeys::HotkeyTrigger>()
        .register::<app::hotkeys::InteractHotkeyMode>()
        .register::<app::hotkeys::OverlayModes>()
        .register::<app::input::InputDevice>()
        .register::<app::input::InputButtonEvent>()
        .register::<app::input::InputDeviceRemap>()
        .register::<app::input::InputDeviceResolution>()
        .register::<app::install::InstallMismatch>()
        .register::<computed::lap_log::LapLogFrame>()
        .register::<pit::pit_action::PitAction>()
        .register::<pit::pit_action::TireCorner>()
        .register::<pit::pit_auto::PitAutoConfig>()
        .register::<pit::pit_auto::PitAutoFrame>()
        .register::<pit::pit_auto::PitAutoMode>()
        .register::<pit::pit_auto::PitClaim>()
        .register::<pit::pit_command::PitCommandKind>()
        .register::<pit::pit_command::PitCommandRequest>()
        .register::<sim::player::CarDynamicsFrame>()
        .register::<sim::player::CarInputsFrame>()
        .register::<sim::player::InputSample>()
        .register::<sim::player::CarStatusFrame>()
        .register::<sim::player::ChassisFrame>()
        .register::<sim::player::LapTimingFrame>()
        .register::<sim::player::PitServiceFrame>()
        .register::<sim::player::PitTargetFrame>()
        .register::<computed::reference_lap::ReferenceLapData>()
        .register::<computed::reference_lap::ReferenceLapSample>()
        .register::<computed::reference_lap::TrackCondition>()
        .register::<app::remote::RemoteDevice>()
        .register::<app::remote::RemoteServerConfig>()
        .register::<app::remote::RemoteServerInfo>()
        .register::<sim::session::SessionFrame>()
        .register::<sim::session::SessionSnapshot>()
        .register::<sim::sim_perf::SimPerfFrame>()
        .register::<computed::track_shape::TrackPoint>()
        .register::<computed::track_shape::TrackRecordingFrame>()
        .register::<computed::track_shape::TrackShapePayload>();

    app::chat::register_types(types);
}
