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

/// Emitted whenever the set of attached devices changes.
pub const INPUT_DEVICES_EVENT: &str = "input://devices";
/// Emitted on every button edge.
pub const INPUT_BUTTON_EVENT: &str = "input://button";

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
