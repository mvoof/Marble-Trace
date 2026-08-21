//! Sim source adapters — the only layer allowed to import kerb.
//! Each sim contributes one adapter that fills the normalized `model` types.

pub mod iracing;
pub mod source;

use crate::model::enums::SimType;
use iracing::source::IracingSource;
use source::TelemetrySource;

/// Instantiates the appropriate source for the given sim type.
/// Returns `None` if the connection attempt fails (sim not running).
pub fn create_source(sim: SimType) -> Option<Box<dyn TelemetrySource>> {
    match sim {
        SimType::IRacing => {
            IracingSource::try_connect().map(|src| Box::new(src) as Box<dyn TelemetrySource>)
        }
    }
}

/// The raw adapted frame, which the telemetry inspector reads whole.
#[cfg(feature = "dev")]
pub fn register_types(types: &mut specta::TypeCollection) {
    types.register::<source::SourceFrame>();
}
