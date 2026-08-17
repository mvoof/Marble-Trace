//! Mirrors the sim events the overlay windows already receive into the remote
//! hub.
//!
//! Tapping Tauri's own event stream instead of the emitter keeps `telemetry/`
//! free of any knowledge that remote clients exist, and the payload arrives
//! here already serialized — the hub forwards the same string rather than
//! encoding the bundle a second time.
use std::sync::Arc;

use tauri::{AppHandle, Listener};

use super::hub::RemoteHub;
use crate::telemetry::emitter::{
    EVENT_CAPABILITIES, EVENT_DISCONNECTED, EVENT_REFERENCE_LAP_UPDATED, EVENT_SESSION_INFO,
    EVENT_STATUS, EVENT_TELEMETRY_BUNDLE, EVENT_TRACK_SHAPE, EVENT_WEATHER_FORECAST,
};

/// Stream chat rides its own namespace: it keeps running with no sim connected,
/// and the widget that draws it works on a remote screen like any other.
const EVENT_CHAT_MESSAGE: &str = "chat://message";
const EVENT_CHAT_PRESENCE: &str = "chat://presence";
const EVENT_CHAT_DELETION: &str = "chat://deletion";

/// Sim events worth forwarding, paired with the message type the browser sees.
///
/// Everything a widget can read has to be here: a remote screen renders the
/// same components as the overlay, so an event that never arrives leaves its
/// widget stuck on its empty state — the track map waiting for a shape, the
/// chat waiting for a message.
const MIRRORED: [(&str, &str); 9] = [
    (EVENT_SESSION_INFO, "session"),
    (EVENT_STATUS, "status"),
    (EVENT_WEATHER_FORECAST, "weather"),
    (EVENT_CAPABILITIES, "capabilities"),
    (EVENT_DISCONNECTED, "disconnected"),
    // Big, but sent once when a track loads — and replayed, so a device that
    // connects mid-session still gets a map.
    (EVENT_TRACK_SHAPE, "track-shape"),
    (EVENT_REFERENCE_LAP_UPDATED, "reference-lap"),
    (EVENT_CHAT_MESSAGE, "chat-message"),
    (EVENT_CHAT_PRESENCE, "chat-presence"),
];

/// Chat deletions are forwarded too, but never replayed: replaying one against
/// a fresh, empty message buffer would do nothing.
const MIRRORED_TRANSIENT: [(&str, &str); 1] = [(EVENT_CHAT_DELETION, "chat-deletion")];

/// Subscribes the hub to the sim event stream for the lifetime of the app.
/// Listeners stay registered while no server runs — the hub drops everything
/// as long as it has no clients, so an idle feature costs one atomic load.
pub fn attach(app: &AppHandle, hub: Arc<RemoteHub>) {
    let bundle_hub = Arc::clone(&hub);

    app.listen(EVENT_TELEMETRY_BUNDLE, move |event| {
        bundle_hub.publish_raw_telemetry(event.payload());
    });

    for (source, kind) in MIRRORED.iter().chain(MIRRORED_TRANSIENT.iter()) {
        let (source, kind) = (*source, *kind);

        let event_hub = Arc::clone(&hub);

        app.listen(source, move |event| {
            event_hub.publish_raw_event(kind, event.payload());
        });
    }
}
