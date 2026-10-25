//! Sim-agnostic telemetry orchestration: thread lifecycle, scheduling and
//! event emission. Sim-specific acquisition lives in the source adapters;
//! this layer only consumes normalized `model` types.

// The app's lint block (`src-tauri/src/lib.rs` says why it is not in `[lints]`).
#![deny(unsafe_op_in_unsafe_fn)]
#![deny(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::undocumented_unsafe_blocks,
    clippy::missing_safety_doc
)]
#![warn(clippy::multiple_unsafe_ops_per_block)]

pub mod delivery;
mod utils;

pub mod control;
pub mod emitter;
pub mod io_worker;
pub mod loop_state;
pub mod runtime;
pub mod state;
pub mod storage;
#[cfg(feature = "dev")]
pub mod tick_timings;

/// The two bundles this layer assembles, and the counters that say what was
/// actually delivered of them.
#[cfg(feature = "dev")]
pub fn register_types(types: &mut specta::TypeCollection) {
    types
        .register::<emitter::TelemetryBundle>()
        .register::<emitter::TelemetrySlowBundle>()
        .register::<delivery::counters::DeliverySet>()
        .register::<delivery::counters::FieldDelivery>();
}
