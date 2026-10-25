//! The seam between a sim and the app: the `TelemetrySource` an adapter
//! implements, the frame it fills, and tapes that stand in for a sim.

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

pub mod raw;
#[cfg(feature = "dev")]
pub mod replay;
#[cfg(feature = "dev")]
pub mod tape;

use serde::{Deserialize, Serialize};

use crate::raw::{RawValues, RawVarMeta, SessionTreeParser};
use mt_model::contract::capabilities::Capabilities;
use mt_model::pit::pit_command::PitCommandRequest;
use mt_model::sim::cars::{CarIdxFrame, CarPositionsFrame, PacingFrame};
use mt_model::sim::enums::SimType;
use mt_model::sim::environment::{EnvironmentFrame, WeatherForecastEntry};
use mt_model::sim::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame, PitServiceFrame,
};
use mt_model::sim::session::{SessionFrame, SessionSnapshot};
use mt_model::sim::sim_perf::SimPerfFrame;

/// One adapted telemetry tick: the domain model frames consumed by the
/// telemetry emitter, filled by whichever sim adapter is connected.
///
/// Serializable because the telemetry inspector reads it whole. It is
/// deliberately a superset of `TelemetryBundle`: the bundle is what the app
/// chose to forward — tiered, demand-gated and quantized — while this is what
/// the sim actually gave us, which is the only useful thing for an inspector to
/// show.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SourceFrame {
    pub car_dynamics: CarDynamicsFrame,
    pub car_inputs: CarInputsFrame,
    pub car_positions: CarPositionsFrame,
    pub car_idx: CarIdxFrame,
    pub chassis: ChassisFrame,
    pub lap_timing: LapTimingFrame,
    pub car_status: CarStatusFrame,
    pub pit_service: PitServiceFrame,
    pub session: SessionFrame,
    pub environment: EnvironmentFrame,
    pub sim_perf: SimPerfFrame,
    /// Absent from tapes recorded before it existed, which then read as no
    /// formation.
    #[serde(default)]
    pub pacing: PacingFrame,
}

/// Result of one session parse: the normalized snapshot plus the
/// weather forecast (emitted as a separate `sim://weather` event).
pub struct ParsedSession {
    pub snapshot: SessionSnapshot,
    pub weather_forecast: Vec<WeatherForecastEntry>,
}

/// Turns a source's raw session text into the normalized session. A plain
/// function rather than a method: it runs on the I/O worker, away from the
/// source, whose connection may not leave the telemetry thread.
pub type SessionParser = fn(&str) -> Option<ParsedSession>;

/// How one sim's session text is read: into the model, and into a tree for
/// the inspector. A replayed tape takes the pair of the sim it was recorded
/// from.
#[cfg(feature = "dev")]
#[derive(Clone, Copy)]
pub struct SessionParsers {
    pub session: SessionParser,
    pub tree: SessionTreeParser,
}

/// Result of a single telemetry read attempt from a source.
#[derive(Debug)]
pub enum SourceReadResult<F> {
    /// Telemetry data is ready.
    Frame(F),
    /// No data arrived within the timeout window.
    NotReady,
    /// The source has disconnected (game closed).
    Disconnected,
}

/// Orders pit service from the sim. iRacing's broadcast channel is
/// fire-and-forget: `Ok` means the order went out, not that the sim took it.
pub trait PitCommander {
    /// Sends a whole order, its requests applied in the order given.
    fn send_pit_order(&self, requests: &[PitCommandRequest]) -> Result<(), String>;
}

/// Abstracts over a connected simulator; implementors live in `sources/`.
pub trait TelemetrySource {
    /// Which simulator this source connects to.
    #[allow(dead_code)]
    fn sim_type(&self) -> SimType;

    /// Bitflags describing what this source can provide.
    fn capabilities(&self) -> Capabilities;

    /// Read the next telemetry frame, blocking up to `timeout_ms`.
    fn read_frame(&mut self, timeout_ms: u32) -> SourceReadResult<SourceFrame>;

    /// Returns `true` if the session YAML version has changed since the last `poll_session`.
    fn session_changed(&mut self) -> bool;

    /// Copy out the raw session text, advancing the internal version counter.
    /// Only the copy happens here — parsing is the I/O worker's, through
    /// `session_parser`, so a session change never costs the tick it lands on.
    fn poll_session(&mut self) -> Option<String>;

    /// How this source's session text is parsed.
    fn session_parser(&self) -> SessionParser;

    /// How this source's session text is turned into a tree for the inspector,
    /// without the project's model.
    fn session_tree_parser(&self) -> SessionTreeParser;

    /// Every telemetry variable the sim declares, as it declares it. Empty for
    /// a source that has no variable list of its own — a tape records adapted
    /// frames, not the sim's variables.
    fn raw_var_meta(&self) -> Vec<RawVarMeta> {
        Vec::new()
    }

    /// Every telemetry variable's value at the latest tick, under the sim's
    /// names. `None` where `raw_var_meta` is empty.
    fn raw_values(&self) -> Option<RawValues> {
        None
    }

    /// How pit orders reach this sim. `None` where they cannot: a sim without
    /// a channel for them, or a replayed tape — a recording with a pit stop in
    /// it must not order one in a live sim.
    fn pit_commander(&self) -> Option<Box<dyn PitCommander>> {
        None
    }

    /// The tape this source plays, when it is a replay rather than a sim.
    fn replay_name(&self) -> Option<String> {
        None
    }
}

/// The adapted frame and the sim's own data, which the telemetry inspector
/// reads whole.
#[cfg(feature = "dev")]
pub fn register_types(types: &mut specta::TypeCollection) {
    types.register::<SourceFrame>();
    types.register::<raw::RawVarMeta>();
    types.register::<raw::RawValue>();
    types.register::<raw::RawSession>();
}
