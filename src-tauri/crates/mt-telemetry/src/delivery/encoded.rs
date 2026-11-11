//! A bundle put on the wire once per delivery group, whoever receives it.

use crate::emitter::TelemetryBundle;

/// One group's bundle, encoded once and handed to every recipient of the
/// group: the windows, the broadcast and the remote screens all take the same
/// string, where each used to encode the bundle again.
pub struct EncodedBundle<'a> {
    /// The bundle as built, for a sink that inspects fields (the tests do).
    pub bundle: &'a TelemetryBundle,
    pub json: String,
    /// Whether it holds a field slower than the overlay clock — known from
    /// the structure, not searched for in the string.
    pub carries_slow_fields: bool,
}

impl<'a> EncodedBundle<'a> {
    pub fn of(bundle: &'a TelemetryBundle) -> Result<Self, serde_json::Error> {
        Ok(Self {
            bundle,
            json: serde_json::to_string(bundle)?,
            carries_slow_fields: bundle.carries_slow_fields(),
        })
    }
}
