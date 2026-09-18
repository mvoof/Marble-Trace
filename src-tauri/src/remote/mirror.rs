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
use crate::model::events::{RemoteStreamKind, EVENT_TELEMETRY_BUNDLE_MIRROR};

/// Subscribes the hub to the sim event stream for the lifetime of the app.
/// Listeners stay registered while no server runs — the hub drops everything
/// as long as it has no clients, so an idle feature costs one atomic load.
pub fn attach(app: &AppHandle, hub: Arc<RemoteHub>) {
    let bundle_hub = Arc::clone(&hub);

    // Not `EVENT_TELEMETRY_BUNDLE`: that one is delivered per window with
    // `emit_to` now, and `emit_to` does not reach a Rust listener. The emitter
    // re-emits the group built for the remote screens' own mask under the
    // mirror name — see `EVENT_TELEMETRY_BUNDLE_MIRROR`.
    app.listen(EVENT_TELEMETRY_BUNDLE_MIRROR, move |event| {
        bundle_hub.publish_raw_telemetry(event.payload());
    });

    for kind in RemoteStreamKind::MIRRORED {
        let Some(source) = kind.source_event() else {
            continue;
        };

        let event_hub = Arc::clone(&hub);

        app.listen(source, move |event| {
            event_hub.publish_raw_event(kind, event.payload());
        });
    }
}
