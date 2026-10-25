//! Global input bindings: the device half.
//!
//! A runtime layer like `telemetry/`: it emits through the app's `EventSink`
//! and never reaches `kerb`, `computations/`, `telemetry/` or `hotkeys/` — an
//! edge reaches the dispatcher through the [`InputHost`] the app hands in.
//! `identity` is pure logic and
//! is the only part that is unit-tested; `dinput_ffi` holds every unsafe COM
//! call behind safe types, and both it and `dinput` are only exercised
//! against real hardware.

pub mod identity;

#[cfg(windows)]
mod com_apartment;

#[cfg(windows)]
pub mod dinput;

#[cfg(windows)]
mod dinput_ffi;

#[cfg(windows)]
mod runtime;

#[cfg(windows)]
pub use runtime::InputRuntime;

pub use crate::model::events::{INPUT_BUTTON_EVENT, INPUT_DEVICES_EVENT};

use std::sync::Arc;

use crate::model::event_sink::EventSink;
use crate::model::input::InputButtonEvent;

/// Called on the poll thread for every button edge.
pub type EdgeHandler = Box<dyn Fn(&InputButtonEvent) + Send>;

/// The top-level window DirectInput's background cooperative level binds to,
/// as a raw handle. Asked for on the poll thread; `None` disables device
/// bindings.
pub type WindowHandle = Box<dyn FnOnce() -> Option<*mut std::ffi::c_void> + Send>;

/// What the app hands the poll thread.
pub struct InputHost {
    pub sink: Arc<dyn EventSink>,
    pub window: WindowHandle,
    pub on_edge: EdgeHandler,
}

#[cfg(not(windows))]
pub struct InputRuntime;

#[cfg(not(windows))]
impl InputRuntime {
    pub fn start(_host: InputHost) -> Self {
        Self
    }

    pub fn set_polling_enabled(&self, _enabled: bool) {}

    pub fn identities(&self) -> Vec<identity::DeviceIdentity> {
        Vec::new()
    }
}
