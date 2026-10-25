//! The wire itself: event names, the demand mask, defaults, the client
//! protocol, the sink events go through, the generated value files and the window
//! labels.

pub mod capabilities;
pub mod client_protocol;
pub mod defaults;
pub mod event_sink;
pub mod events;
#[cfg(feature = "dev")]
pub mod generated_paths;
pub mod telemetry_events;
pub mod ts_values;
pub mod windows;
