//! What the runtimes need from Tauri, behind their own traits: events to the
//! windows, and the embedded frontend bundle.

use tauri::{AppHandle, Emitter};

use crate::model::event_sink::EventSink;
use crate::remote::server::{BundleAsset, BundleAssets};

pub struct TauriSink(pub AppHandle);

impl EventSink for TauriSink {
    fn emit_json(&self, event: &str, payload: String) -> Result<(), String> {
        self.0
            .emit_str(event, payload)
            .map_err(|error| error.to_string())
    }

    fn emit_json_to(&self, label: &str, event: &str, payload: String) -> Result<(), String> {
        self.0
            .emit_str_to(label, event, payload)
            .map_err(|error| error.to_string())
    }
}

pub struct TauriAssets(pub AppHandle);

impl BundleAssets for TauriAssets {
    fn get(&self, path: String) -> Option<BundleAsset> {
        let asset = self.0.asset_resolver().get(path)?;

        Some(BundleAsset {
            bytes: asset.bytes,
            mime_type: asset.mime_type,
        })
    }
}
