//! Owns the kerb connection. !Send — lives entirely on the telemetry thread.

use kerb::iracing::IRsdkConnection;
use kerb::{Connection, SimConnection, SimType as KerbSimType, TelemetryValue};
use tracing::{debug, warn};

use super::frame_map::DeclaredVars;
use super::session_parse;
use crate::model::enums::SimType;
use crate::sources::raw::{RawValue, RawValues, RawVarMeta, SessionTreeParser};
use crate::sources::source::{SessionParser, SourceFrame, SourceReadResult, TelemetrySource};
use crate::telemetry::capabilities::Capabilities;

pub struct IracingSource {
    connection: Box<IRsdkConnection>,
    last_session_version: i32,
    /// What this car declares. Read once — the sim fixes the variable list for
    /// the session when the connection opens.
    declared: DeclaredVars,
    /// The same list as the sim describes it, for the inspector.
    var_meta: Vec<RawVarMeta>,
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

                let mut var_meta: Vec<RawVarMeta> = vars
                    .iter()
                    .map(|var| RawVarMeta {
                        name: var.name.clone(),
                        type_name: var.type_name.to_string(),
                        unit: var.unit.clone(),
                        desc: var.desc.clone(),
                        count: var.count,
                    })
                    .collect();

                var_meta.sort_by(|left, right| left.name.cmp(&right.name));

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
                    var_meta,
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

    /// Copies the current session YAML out of shared memory and advances
    /// `last_session_version`. `None` when the sim has no YAML to give.
    fn poll_session(&mut self) -> Option<String> {
        let current_version = self.connection.session_info_update();

        debug!(
            "Session version change: {} -> {}",
            self.last_session_version, current_version
        );

        self.last_session_version = current_version;

        let Some(raw_yaml) = self.connection.session_yaml() else {
            warn!("session_yaml() returned None (version {})", current_version);

            return None;
        };

        debug!("Fetched session YAML ({} bytes)", raw_yaml.len());

        Some(raw_yaml)
    }

    fn session_parser(&self) -> SessionParser {
        session_parse::parse_session
    }

    fn session_tree_parser(&self) -> SessionTreeParser {
        session_parse::session_tree
    }

    fn raw_var_meta(&self) -> Vec<RawVarMeta> {
        self.var_meta.clone()
    }

    fn raw_values(&self) -> Option<RawValues> {
        Some(
            self.connection
                .telemetry_snapshot()
                .into_iter()
                .map(|(name, value)| (name, raw_value(value)))
                .collect(),
        )
    }
}

/// A one-to-one copy of kerb's value, which does not serialize itself. A single
/// `char` is a byte, not a letter, and goes out as its number.
fn raw_value(value: TelemetryValue) -> RawValue {
    match value {
        TelemetryValue::Char(byte) => RawValue::Int(i32::from(byte)),
        TelemetryValue::String(text) | TelemetryValue::Text(text) => RawValue::Text(text),
        TelemetryValue::Bool(flag) => RawValue::Bool(flag),
        TelemetryValue::Int(number) => RawValue::Int(number),
        TelemetryValue::BitField(bits) => RawValue::BitField(bits),
        TelemetryValue::Float(number) => RawValue::Float(number),
        TelemetryValue::Double(number) => RawValue::Double(number),
        TelemetryValue::BoolArray(items) => RawValue::BoolArray(items),
        TelemetryValue::IntArray(items) => RawValue::IntArray(items),
        TelemetryValue::FloatArray(items) => RawValue::FloatArray(items),
        TelemetryValue::DoubleArray(items) => RawValue::DoubleArray(items),
    }
}
