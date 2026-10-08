//! The sim's own data before any adapter touches it: every telemetry variable
//! under the sim's name, and the session text as the sim wrote it.
//!
//! Read only by the telemetry inspector and the snapshot export. Nothing here
//! is mapped, renamed, masked or rounded — the values are copied one to one
//! out of kerb's types, which do not serialize themselves.

use std::collections::BTreeMap;

use serde::Serialize;

/// One telemetry variable as the sim declares it. Fixed for a connection: the
/// sim publishes its variable list once, when the connection opens.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawVarMeta {
    pub name: String,
    /// The sim's storage type: `float`, `double`, `int`, `bitfield`, `bool`, `char`.
    pub type_name: String,
    pub unit: String,
    pub desc: String,
    /// `1` for a scalar, the length for an array (`64` for a `CarIdx*` one).
    pub count: u32,
}

/// One variable's current value. Untagged: the frontend sees a plain number,
/// boolean, string or array, and the storage type is in `RawVarMeta`.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Debug, Clone)]
#[serde(untagged)]
pub enum RawValue {
    Bool(bool),
    Int(i32),
    BitField(u32),
    Float(f32),
    Double(f64),
    Text(String),
    BoolArray(Vec<bool>),
    IntArray(Vec<i32>),
    FloatArray(Vec<f32>),
    DoubleArray(Vec<f64>),
}

/// Every variable's value at one tick, keyed by the sim's name.
pub type RawValues = BTreeMap<String, RawValue>;

/// The session text as the sim wrote it, and the same text as a tree.
///
/// The tree keeps the document's own key order. It is `null` when the text
/// does not parse — the text is still there to read.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Debug, Clone)]
pub struct RawSession {
    pub yaml: String,
    #[cfg_attr(feature = "dev", specta(type = serde_json::Value))]
    pub tree: serde_yaml_ng::Value,
}

/// Turns a source's session text into a tree, without reading it into the
/// project's model. A plain function for the same reason as `SessionParser`:
/// it runs off the telemetry thread, on a command.
pub type SessionTreeParser = fn(&str) -> serde_yaml_ng::Value;
