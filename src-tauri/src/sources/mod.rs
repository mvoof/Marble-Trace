//! Sim source adapters — the only layer allowed to import kerb.
//! Each sim contributes one adapter that fills the normalized `model` types.

pub mod iracing;
pub mod raw;
#[cfg(feature = "dev")]
pub mod replay;
pub mod source;
#[cfg(feature = "dev")]
pub mod tape;

use crate::model::enums::SimType;
use iracing::source::IracingSource;
use source::TelemetrySource;

/// Instantiates the appropriate source for the given sim type.
/// Returns `None` if the connection attempt fails (sim not running).
pub fn create_source(sim: SimType) -> Option<Box<dyn TelemetrySource>> {
    #[cfg(feature = "dev")]
    if let Some(replay) = replay::replay_from_env() {
        return Some(replay);
    }

    let live = match sim {
        SimType::IRacing => {
            IracingSource::try_connect().map(|src| Box::new(src) as Box<dyn TelemetrySource>)
        }
    };

    #[cfg(feature = "dev")]
    let live = live.map(replay::record_if_requested);

    live
}

/// The adapted frame and the sim's own data, which the telemetry inspector
/// reads whole.
#[cfg(feature = "dev")]
pub fn register_types(types: &mut specta::TypeCollection) {
    types.register::<source::SourceFrame>();
    types.register::<raw::RawVarMeta>();
    types.register::<raw::RawValue>();
    types.register::<raw::RawSession>();
}
