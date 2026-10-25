//! How events reach the frontend. The app implements `EventSink` over Tauri's
//! `AppHandle`; the runtimes that emit — telemetry, chat, input — never learn
//! what carries them.

use serde::Serialize;

/// Takes events already encoded as JSON. Encoding here rather than in the
/// implementation is what keeps the trait object-safe; Tauri's own `emit`
/// encodes the same way, once, before it reaches any window.
pub trait EventSink: Send + Sync {
    /// Sends `payload` to every listener.
    fn emit_json(&self, event: &str, payload: String) -> Result<(), String>;

    /// Sends `payload` to the one window labelled `label`.
    fn emit_json_to(&self, label: &str, event: &str, payload: String) -> Result<(), String>;
}

impl dyn EventSink + '_ {
    pub fn emit<T: Serialize + ?Sized>(&self, event: &str, payload: &T) -> Result<(), String> {
        let json = serde_json::to_string(payload).map_err(|error| error.to_string())?;

        self.emit_json(event, json)
    }

    pub fn emit_to<T: Serialize + ?Sized>(
        &self,
        label: &str,
        event: &str,
        payload: &T,
    ) -> Result<(), String> {
        let json = serde_json::to_string(payload).map_err(|error| error.to_string())?;

        self.emit_json_to(label, event, json)
    }
}
