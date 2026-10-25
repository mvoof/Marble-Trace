//! Sim-agnostic telemetry orchestration: thread lifecycle, scheduling and
//! event emission. Sim-specific acquisition lives in the source adapters;
//! this layer only consumes normalized `model` types.

pub mod delivery;

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
