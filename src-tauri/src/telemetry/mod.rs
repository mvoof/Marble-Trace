//! Sim-agnostic telemetry orchestration: thread lifecycle, scheduling and
//! event emission. Sim-specific acquisition lives in the source adapters;
//! this layer only consumes normalized `model` types.

pub mod capabilities;
pub mod emitter;
pub mod publications;
pub mod quantize;
pub mod runtime;
pub mod scheduler;
pub mod state;
