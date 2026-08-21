//! Global input bindings: the device half.
//!
//! A runtime layer like `telemetry/` — it may use `tauri` to emit events, but
//! never `kerb`, `computations/` or `telemetry/`. `identity` is pure logic and
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

#[cfg(not(windows))]
pub struct InputRuntime;

#[cfg(not(windows))]
impl InputRuntime {
    pub fn start(_app: tauri::AppHandle) -> Self {
        Self
    }

    pub fn set_polling_enabled(&self, _enabled: bool) {}

    pub fn identities(&self) -> Vec<identity::DeviceIdentity> {
        Vec::new()
    }
}
