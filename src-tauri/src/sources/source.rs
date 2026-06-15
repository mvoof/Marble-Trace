//! Sim-agnostic telemetry source trait.

use crate::model::cars::{CarIdxFrame, CarPositionsFrame};
use crate::model::enums::SimType;
use crate::model::environment::{EnvironmentFrame, WeatherForecastEntry};
use crate::model::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame,
};
use crate::model::session::{SessionFrame, SessionSnapshot};
use crate::telemetry::capabilities::Capabilities;

/// One adapted telemetry tick: the domain model frames consumed by the
/// telemetry emitter, filled by whichever sim adapter is connected.
pub struct SourceFrame {
    pub car_dynamics: CarDynamicsFrame,
    pub car_inputs: CarInputsFrame,
    pub car_positions: CarPositionsFrame,
    pub car_idx: CarIdxFrame,
    pub chassis: ChassisFrame,
    pub lap_timing: LapTimingFrame,
    pub car_status: CarStatusFrame,
    pub session: SessionFrame,
    pub environment: EnvironmentFrame,
}

/// Result of one session poll: the normalized snapshot plus the
/// weather forecast (emitted as a separate `sim://weather` event).
pub struct ParsedSession {
    pub snapshot: SessionSnapshot,
    pub weather_forecast: Vec<WeatherForecastEntry>,
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

    /// Parse and return updated session data, advancing the internal version counter.
    fn poll_session(&mut self) -> Option<ParsedSession>;
}
