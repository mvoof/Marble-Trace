//! Sim-agnostic telemetry orchestration: thread lifecycle, scheduling and
//! event emission. Sim-specific acquisition lives in the source adapters;
//! this layer only consumes normalized `model` types.

pub mod capabilities;
pub mod control;
pub mod delivery;
pub mod dispatch;
pub mod emitter;
pub mod io_worker;
pub mod loop_state;
pub mod masks;
#[cfg(feature = "dev")]
pub mod perf_run;
pub mod publications;
pub mod quantize;
pub mod runtime;
pub mod scheduler;
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
        .register::<delivery::DeliverySet>()
        .register::<delivery::FieldDelivery>()
        .register::<perf_run::PerfRunConfig>()
        .register::<perf_run::OverlayPerfReport>();
}
