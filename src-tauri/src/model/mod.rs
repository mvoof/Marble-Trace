//! Normalized telemetry model — the only backend -> frontend contract.
//! Filled by sim sources, consumed by computations and the emitter.
//! Must not import tauri, kerb or any sim-specific module.

pub mod capabilities;
pub mod cars;
pub mod chat;
pub mod enums;
pub mod environment;
pub mod flags;
pub mod input;
pub mod lap_log;
pub mod pit_command;
pub mod player;
pub mod reference_lap;
pub mod relative;
pub mod remote;
pub mod session;
pub mod track_shape;
