//! What the Crew tab is shown of the catalog and the audio devices.

use mt_model::app::voice::{AudioDeviceView, VoiceComponentState, VoiceComponentView};

use crate::assets::catalog::{Component, ComponentKind};
use crate::assets::VoiceAssets;
use crate::playback::AudioDevice;

/// One catalog component and whether it is installed, outdated or missing.
pub fn component_view(assets: &VoiceAssets, component: &Component) -> VoiceComponentView {
    let state = if assets.is_installed(component) {
        VoiceComponentState::Installed
    } else if assets.is_outdated(component) {
        VoiceComponentState::Outdated
    } else {
        VoiceComponentState::Missing
    };
    let kind = match component.kind {
        ComponentKind::TtsEngine => "ttsEngine",
        ComponentKind::SttEngine => "sttEngine",
        ComponentKind::TtsVoice => "ttsVoice",
        ComponentKind::SttModel => "sttModel",
    };

    VoiceComponentView {
        id: component.id.clone(),
        kind: kind.to_string(),
        language: component.language.clone(),
        title: component.title.clone(),
        license: component.license.clone(),
        license_url: component.license_url.clone(),
        size_bytes: component.size() as f64,
        recommended: component.recommended,
        sample_url: component.sample.clone(),
        state,
    }
}

pub fn device_views(devices: Vec<AudioDevice>) -> Vec<AudioDeviceView> {
    devices
        .into_iter()
        .map(|device| AudioDeviceView {
            id: device.id,
            name: device.name,
            is_default: device.is_default,
        })
        .collect()
}
