//! Frontend entry points for the device-input runtime.

use tauri::State;

use crate::model::input::{InputDevice, InputDeviceRemap, InputDeviceResolution};

use super::identity::resolve_remaps;
use super::InputRuntime;

/// The runtime is created in `setup`, so it is optional here — a machine where
/// DirectInput failed to initialise still runs, just with keyboard bindings.
pub struct InputState {
    pub runtime: Option<InputRuntime>,
}

/// Reconciles the devices the frontend has bindings for against the attached
/// ones. The caller passes what it remembers because the backend keeps no
/// persisted state of its own — settings.json is owned by the frontend.
#[tauri::command]
pub fn resolve_input_devices(
    state: State<'_, InputState>,
    known: Vec<InputDevice>,
) -> InputDeviceResolution {
    let Some(runtime) = state.runtime.as_ref() else {
        return InputDeviceResolution {
            devices: known
                .into_iter()
                .map(|device| InputDevice {
                    connected: false,
                    ..device
                })
                .collect(),
            remaps: Vec::new(),
        };
    };

    let attached = runtime.identities();

    let remaps = resolve_remaps(&known, &attached)
        .into_iter()
        .map(|remap| InputDeviceRemap {
            previous_id: remap.previous_id,
            next_id: remap.next_id,
        })
        .collect();

    InputDeviceResolution {
        devices: super::identity::merge_device_lists(&known, &attached),
        remaps,
    }
}

/// Polling is switched off while nothing is listening — no capture modal open
/// and no device binding in use — so an idle overlay costs no wheel reads.
#[tauri::command]
pub fn set_input_polling_enabled(state: State<'_, InputState>, enabled: bool) {
    if let Some(runtime) = state.runtime.as_ref() {
        runtime.set_polling_enabled(enabled);
    }
}
