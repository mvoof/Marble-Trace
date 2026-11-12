//! Mirrors the rare sim events — session, status, weather — into the remote
//! hub, for the remote screens. The telemetry bundle does not come this way:
//! the runtime hands it to the hub itself (`BundleTap`).
//!
//! The payload arrives here already serialized; the hub forwards the same
//! string rather than encoding it a second time.
use std::sync::Arc;

use tauri::{AppHandle, Listener};

use mt_model::contract::events::RemoteStreamKind;
use mt_remote::hub::RemoteHub;

/// Subscribes the hub to the mirrored events for the lifetime of the app.
/// Listeners stay registered while no server runs — the hub drops everything
/// as long as it has no clients, so an idle feature costs one atomic load.
pub fn attach(app: &AppHandle, hub: Arc<RemoteHub>) {
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
