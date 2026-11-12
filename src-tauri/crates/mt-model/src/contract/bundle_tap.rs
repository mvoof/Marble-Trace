//! Where the remote screens take their telemetry from. The telemetry runtime
//! hands each encoded bundle meant for them to this tap directly; the app
//! plugs the remote hub in, so the runtime never learns the hub exists.

/// Receives the bundle encoded for the remote screens' own mask.
pub trait BundleTap: Send + Sync {
    /// `json` is the encoded bundle. `carries_slow_fields` says it holds a
    /// field slower than the overlay clock — such a tick is never thinned by
    /// the remote rate limit, or the session clock and the fuel numbers would
    /// skip with the motion data.
    fn publish_bundle(&self, json: &str, carries_slow_fields: bool);
}
