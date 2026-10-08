//! Sim-agnostic telemetry source trait.

use serde::{Deserialize, Serialize};

use crate::model::cars::{CarIdxFrame, CarPositionsFrame};
use crate::model::enums::SimType;
use crate::model::environment::{EnvironmentFrame, WeatherForecastEntry};
use crate::model::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame, PitServiceFrame,
};
use crate::model::session::{SessionFrame, SessionSnapshot};
use crate::model::sim_perf::SimPerfFrame;
use crate::sources::raw::{RawValues, RawVarMeta, SessionTreeParser};
use crate::telemetry::capabilities::Capabilities;

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

    /// The tape this source plays, when it is a replay rather than a sim.
    fn replay_name(&self) -> Option<String> {
        None
    }
}
