//! Global input bindings: the device half.
//!
//! A runtime layer like `telemetry/` — it may use `tauri` to emit events, but
//! never `kerb`, `computations/`, `telemetry/` or `hotkeys/`: an edge reaches
//! the dispatcher through the [`EdgeHandler`] `lib.rs` hands in. `identity` is pure logic and
//! is the only part that is unit-tested; `dinput` is unsafe COM and is only
//! exercised against real hardware.

pub mod commands;
pub mod identity;

#[cfg(windows)]
pub mod dinput;

#[cfg(windows)]
mod runtime;

#[cfg(windows)]
pub use runtime::InputRuntime;

pub use crate::model::events::{INPUT_BUTTON_EVENT, INPUT_DEVICES_EVENT};

/// Called on the poll thread for every button edge.
pub type EdgeHandler = fn(&tauri::AppHandle, &crate::model::input::InputButtonEvent);

#[cfg(not(windows))]
pub struct InputRuntime;

#[cfg(not(windows))]
impl InputRuntime {
    pub fn start(_app: tauri::AppHandle, _on_edge: EdgeHandler) -> Self {
        Self
    }

    pub fn set_polling_enabled(&self, _enabled: bool) {}

    pub fn identities(&self) -> Vec<identity::DeviceIdentity> {
        Vec::new()
    }
}
