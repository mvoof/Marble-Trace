//! Owns the kerb connection. !Send — lives entirely on the telemetry thread.

use kerb::iracing::IRsdkConnection;
use kerb::{Connection, SimConnection, SimType as KerbSimType};
use tracing::{debug, warn};

use super::frame_map::DeclaredVars;
use super::session_parse;
use crate::model::enums::SimType;
use crate::sources::source::{ParsedSession, SourceFrame, SourceReadResult, TelemetrySource};
use crate::telemetry::capabilities::Capabilities;

pub struct IracingSource {
    connection: Box<IRsdkConnection>,
    last_session_version: i32,
    /// What this car declares. Read once — the sim fixes the variable list for
    /// the session when the connection opens.
    declared: DeclaredVars,
}

impl IracingSource {
    /// Single connection attempt. Returns `Some` on success, `None` on any failure.
    /// The retry loop with sleep + running check lives in runtime.
    pub fn try_connect() -> Option<Self> {
        match SimConnection::connect_to(KerbSimType::IRacing) {
            Ok(Connection::IRacing(conn)) => {
                let vars = conn.var_list_snapshot();

                // What this car publishes, and what the car itself calls it.
                //
                // The `dc*` variables are generic rotary slots, not fixed
                // controls: iRacing hangs whatever that car's wheel actually
                // adjusts on them, so `dcABS` carries brake bias migration on a
                // GTP car and ABS on a GT3. The slot name is therefore not the
                // label — the description is, and it is the only place the
                // car's own wording exists. Logged once per connection, because
                // the telemetry inspector can only show fields the adapter
                // already maps and a slot nothing reads yet is invisible
                // everywhere else.
                let mut adjustments: Vec<String> = vars
                    .iter()
                    .filter(|var| {
                        var.name.starts_with("dc")
                            || var.name.starts_with("Energy")
                            || var.name.starts_with("Power")
                            || var.name.starts_with("Torque")
                            || var.name.contains("DRS")
                            || var.name.contains("PushToPass")
                    })
                    .map(|var| format!("{} = {:?} [{}]", var.name, var.desc, var.unit))
                    .collect();

                adjustments.sort();

                for line in &adjustments {
                    debug!("iRacing adjustment var: {line}");
                }

                let mut names: Vec<String> = vars.into_iter().map(|var| var.name).collect();
                names.sort();

                debug!(
                    count = names.len(),
                    "iRacing declared vars: {}",
                    names.join(" ")
                );

                let declared = DeclaredVars::new(names);

                Some(Self {
                    connection: conn,
                    last_session_version: -1,
                    declared,
                })
            }
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
                let mut frame = SourceFrame::from(&raw_frame);
                self.declared.mask_car_status(&mut frame.car_status);

                SourceReadResult::Frame(frame)
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
