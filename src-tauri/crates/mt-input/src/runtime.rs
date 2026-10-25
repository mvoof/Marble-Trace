//! Owns the DirectInput poll thread: its edges go to the hotkey dispatcher
//! and, as events, to the settings screen that captures a binding.
//!
//! The COM objects are apartment-affine, so the session is created on the poll
//! thread and never leaves it. Everything the rest of the app needs — the
//! device list, the on/off switch — crosses the boundary as plain data.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

use windows::Win32::Foundation::HWND;

use mt_model::input::{InputButtonEvent, InputDevice};

use super::com_apartment::ComApartment;
use super::dinput::{DirectInputSession, POLL_INTERVAL};
use super::identity::DeviceIdentity;
use super::{InputHost, INPUT_BUTTON_EVENT, INPUT_DEVICES_EVENT};

pub struct InputRuntime {
    /// Off while nothing is listening — the overlay is hidden and no capture
    /// modal is open — so the thread costs nothing in the common case.
    enabled: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
    devices: Arc<Mutex<Vec<DeviceIdentity>>>,
}

impl InputRuntime {
    pub fn start(host: InputHost) -> Self {
        let enabled = Arc::new(AtomicBool::new(true));
        let running = Arc::new(AtomicBool::new(true));
        let devices = Arc::new(Mutex::new(Vec::new()));

        let runtime = Self {
            enabled: enabled.clone(),
            running: running.clone(),
            devices: devices.clone(),
        };

        thread::Builder::new()
            .name("input-poll".to_string())
            .spawn(move || poll_loop(host, enabled, running, devices))
            .map_err(|error| tracing::error!("failed to start input poll thread: {error}"))
            .ok();

        runtime
    }

    pub fn set_polling_enabled(&self, value: bool) {
        self.enabled.store(value, Ordering::Relaxed);
    }

    /// Snapshot of what is attached right now, for the reconcile command.
    pub fn identities(&self) -> Vec<DeviceIdentity> {
        self.devices
            .lock()
            .map(|identities| identities.clone())
            .unwrap_or_default()
    }
}

impl Drop for InputRuntime {
    fn drop(&mut self) {
        self.running.store(false, Ordering::Relaxed);
    }
}

fn poll_loop(
    host: InputHost,
    enabled: Arc<AtomicBool>,
    running: Arc<AtomicBool>,
    devices: Arc<Mutex<Vec<DeviceIdentity>>>,
) {
    let InputHost {
        sink,
        window,
        on_edge,
    } = host;

    // DirectInput needs a real top-level window for background cooperative
    // level. The handle is just a pointer, so it is wrapped here rather than
    // converted from another windows-rs version's type.
    let Some(hwnd) = window().map(HWND) else {
        return;
    };

    // Bound before the session: the DirectInput objects drop first, the
    // apartment last.
    let _apartment = match ComApartment::enter() {
        Ok(apartment) => apartment,
        Err(error) => {
            tracing::warn!("COM unavailable, device bindings disabled: {error}");

            return;
        }
    };

    let session = DirectInputSession::new(hwnd);

    let mut session = match session {
        Ok(session) => session,
        Err(error) => {
            tracing::warn!("DirectInput unavailable, device bindings disabled: {error}");

            return;
        }
    };

    while running.load(Ordering::Relaxed) {
        // Enumeration runs even when button polling is off: the settings screen
        // has to show a wheel being plugged in before any binding exists for it,
        // and it costs one call every couple of seconds.
        if session.should_reenumerate() && session.refresh_devices() {
            let identities = session.identities();

            if let Ok(mut shared) = devices.lock() {
                *shared = identities.clone();
            }

            let payload: Vec<InputDevice> = identities
                .iter()
                .map(|identity| identity.to_device(true))
                .collect();

            let _ = sink.emit(INPUT_DEVICES_EVENT, &payload);
        }

        // Reading button state is what the on/off switch actually gates.
        if enabled.load(Ordering::Relaxed) {
            for edge in session.poll() {
                let event = InputButtonEvent {
                    device_id: edge.device_id,
                    button: edge.button,
                    pressed: edge.pressed,
                };

                on_edge(&event);

                let _ = sink.emit(INPUT_BUTTON_EVENT, &event);
            }
        }

        thread::sleep(POLL_INTERVAL);
    }
}
