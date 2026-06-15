//! Owns the kerb connection. !Send — lives entirely on the telemetry thread.

use kerb::iracing::IRsdkConnection;
use kerb::{Connection, SimConnection, SimType as KerbSimType};
use tracing::{debug, warn};

use super::session_parse;
use crate::model::enums::SimType;
use crate::sources::source::{ParsedSession, SourceFrame, SourceReadResult, TelemetrySource};
use crate::telemetry::capabilities::Capabilities;

pub struct IracingSource {
    connection: Box<IRsdkConnection>,
    last_session_version: i32,
}

impl IracingSource {
    /// Single connection attempt. Returns `Some` on success, `None` on any failure.
    /// The retry loop with sleep + running check lives in runtime.
    pub fn try_connect() -> Option<Self> {
        match SimConnection::connect_to(KerbSimType::IRacing) {
            Ok(Connection::IRacing(conn)) => Some(Self {
                connection: conn,
                last_session_version: -1,
            }),
            Ok(_) => {
                warn!("connect_to(IRacing) returned a non-iRacing connection");

                None
            }
            Err(e) => {
                debug!("iRacing connect failed: {e}");

                None
            }
        }
    }
}

impl TelemetrySource for IracingSource {
    fn sim_type(&self) -> SimType {
        SimType::IRacing
    }

    fn capabilities(&self) -> Capabilities {
        Capabilities::all()
    }

    /// Reads a single frame blocking up to `timeout_ms`.
    fn read_frame(&mut self, timeout_ms: u32) -> SourceReadResult<SourceFrame> {
        match self.connection.read_frame(timeout_ms) {
            kerb::ReadResult::Frame(raw_frame) => {
                SourceReadResult::Frame(SourceFrame::from(&raw_frame))
            }
            kerb::ReadResult::NotReady => SourceReadResult::NotReady,
            kerb::ReadResult::Disconnected => SourceReadResult::Disconnected,
        }
    }

    /// Cheap version-counter check. Does NOT advance `last_session_version`.
    fn session_changed(&mut self) -> bool {
        self.connection.session_info_update() != self.last_session_version
    }

    /// Reads the current session YAML, parses it, advances `last_session_version`.
    /// Returns the parsed session on success, `None` on missing YAML or parse failure.
    fn poll_session(&mut self) -> Option<ParsedSession> {
        let current_version = self.connection.session_info_update();

        debug!(
            "Session version change: {} -> {}",
            self.last_session_version, current_version
        );

        let Some(raw_yaml) = self.connection.session_yaml() else {
            warn!("session_yaml() returned None (version {})", current_version);
            self.last_session_version = current_version;

            return None;
        };

        debug!("Fetched session YAML ({} bytes)", raw_yaml.len());

        let result = session_parse::parse_session(&raw_yaml);

        if result.is_none() {
            warn!(
                "Session YAML parse error (version {}). YAML snippet: {:.100}",
                current_version, raw_yaml
            );
        }

        self.last_session_version = current_version;

        result
    }
}
