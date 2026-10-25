//! The sims this build connects to. The telemetry runtime knows none of them:
//! it is handed `connect_source` and calls it until a sim answers.

use crate::sources::iracing::source::IracingSource;
#[cfg(feature = "dev")]
use crate::sources::iracing::SESSION_PARSERS as IRACING_SESSION_PARSERS;
#[cfg(feature = "dev")]
use crate::sources::replay::{record_if_requested, replay_from_env};
use crate::sources::source::TelemetrySource;
#[cfg(feature = "dev")]
use crate::{model::enums::SimType, sources::source::SessionParsers};

/// The running sim's source, `None` while no sim is running. In a dev build a
/// tape named by `MARBLE_TRACE_REPLAY` stands in for the sim, and
/// `MARBLE_TRACE_RECORD` records the live one.
pub fn connect_source() -> Option<Box<dyn TelemetrySource>> {
    #[cfg(feature = "dev")]
    if let Some(replay) = replay_from_env(session_parsers) {
        return Some(replay);
    }

    let live = IracingSource::try_connect().map(|src| Box::new(src) as Box<dyn TelemetrySource>);

    #[cfg(feature = "dev")]
    let live = live.map(record_if_requested);

    live
}

/// The session parsers of the sim a tape was recorded from.
#[cfg(feature = "dev")]
fn session_parsers(sim: SimType) -> SessionParsers {
    match sim {
        SimType::IRacing => IRACING_SESSION_PARSERS,
    }
}
