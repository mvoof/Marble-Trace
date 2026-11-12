//! What the Crew tab is shown of the catalog and the audio devices.

use std::path::Path;

use mt_model::app::voice::{AudioDeviceView, VoiceComponentState, VoiceComponentView, VoiceStatus};

use crate::assets::catalog::{catalog, Component, ComponentKind};
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

/// The Crew tab's whole status: the catalog against what is installed under
/// `root`, the imported voices and the audio devices.
pub fn status_view(
    root: &Path,
    inputs: Vec<AudioDevice>,
    outputs: Vec<AudioDevice>,
) -> VoiceStatus {
    let assets = VoiceAssets::new(root);
    let components = catalog()
        .components
        .iter()
        .map(|component| component_view(&assets, component))
        .collect();
    let custom_voices = assets
        .custom_voices()
        .into_iter()
        .map(|voice| voice.name)
        .collect();

    VoiceStatus {
        voice_folder: root.to_string_lossy().into_owned(),
        components,
        custom_voices,
        inputs: device_views(inputs),
        outputs: device_views(outputs),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_fresh_folder_lists_the_whole_catalog_as_missing() {
        let root = std::env::temp_dir().join(format!("mt-voice-views-{}", std::process::id()));
        let device = AudioDevice {
            id: "1".to_string(),
            name: "Mic".to_string(),
            is_default: true,
        };
        let status = status_view(&root, vec![device], Vec::new());

        assert_eq!(status.components.len(), catalog().components.len());
        assert!(status
            .components
            .iter()
            .all(|view| view.state == VoiceComponentState::Missing));
        assert!(status.custom_voices.is_empty());
        assert_eq!(status.inputs.len(), 1);
        assert!(status.inputs[0].is_default);
        assert!(status.outputs.is_empty());
        assert_eq!(status.voice_folder, root.to_string_lossy());
    }
}
