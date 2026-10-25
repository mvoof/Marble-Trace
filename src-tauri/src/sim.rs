//! The sims this build connects to. The telemetry runtime knows none of them:
//! it is handed `connect_source` and calls it until a sim answers.

#[cfg(feature = "dev")]
use mt_model::sim::enums::SimType;
use mt_sim_iracing::source::IracingSource;
#[cfg(feature = "dev")]
use mt_sim_iracing::SESSION_PARSERS as IRACING_SESSION_PARSERS;
#[cfg(feature = "dev")]
use mt_source::replay::{record_if_requested, replay_from_env};
#[cfg(feature = "dev")]
use mt_source::SessionParsers;
use mt_source::TelemetrySource;

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
