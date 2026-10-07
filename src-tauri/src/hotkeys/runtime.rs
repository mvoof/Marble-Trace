//! The dispatcher's state and the side effects of a fired action.

use std::collections::BTreeSet;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tracing::{debug, info, warn};

use crate::computations::pit_auto::PitAutoCommand;
use crate::model::events::{
    RemoteControlKind, WireName, EVENT_CLIENT_CONTROL, EVENT_HOTKEY_SETTINGS_ACTION,
    EVENT_OVERLAY_MODES,
};
use crate::model::hotkeys::{
    Binding, HotkeyContext, HotkeyEffect, HotkeySettingsAction, OverlayModes, ViewControl,
};
use crate::model::input::InputButtonEvent;
use crate::model::pit_action::PitAction;
use crate::remote::commands::RemoteState;
use crate::telemetry::control::TelemetryCommand;
use crate::telemetry::state::TelemetryState;
use crate::utils::lock_or_recover;

use super::dispatch::{fired_actions, keyboard_accelerators, BindingMap, Fired};
use super::modes::{interact_after_key, with_drag, with_interact};

/// The main window, which owns the settings a settings action writes.
const MAIN_WINDOW_LABEL: &str = "main";

/// Overlay windows are created per monitor, labelled `overlay-<monitor>`.
const OVERLAY_LABEL_PREFIX: &str = "overlay-";

const MS_PER_SECOND: f32 = 1000.0;

#[derive(Default)]
struct Inner {
    /// Empty until the main window pushes its map: a key the user unbound must
    /// not fire because the settings file had not been read yet.
    bindings: BindingMap,
    context: HotkeyContext,
    modes: OverlayModes,
    /// Bumped whenever interact mode is set, so an auto-off timer armed for an
    /// earlier switch-on finds itself stale and does nothing.
    interact_generation: u64,
    /// What is registered with the OS right now.
    registered: BTreeSet<String>,
}

#[derive(Default)]
pub struct HotkeyState {
    inner: Mutex<Inner>,
    /// Held across a whole re-registration, so two pushes in quick succession
    /// cannot interleave their unregister and register calls.
    registration: Mutex<()>,
}

impl HotkeyState {
    pub fn modes(&self) -> OverlayModes {
        lock_or_recover(&self.inner).modes
    }
}

fn state(app: &AppHandle) -> &HotkeyState {
    app.state::<HotkeyState>().inner()
}

/// A binding went down or up: run what it fires.
pub fn on_binding_edge(app: &AppHandle, binding: &Binding, pressed: bool) {
    let (fired, context, modes) = {
        let inner = lock_or_recover(&state(app).inner);

        (
            fired_actions(&inner.bindings, binding, pressed, &inner.context),
            inner.context.clone(),
            inner.modes,
        )
    };

    for action in fired {
        run(app, action, pressed, &context, modes);
    }
}

/// The DirectInput poll thread's edges, handed in by `lib.rs`.
pub fn on_device_edge(app: &AppHandle, edge: &InputButtonEvent) {
    on_binding_edge(
        app,
        &Binding::Device {
            device_id: edge.device_id.clone(),
            button: edge.button,
        },
        edge.pressed,
    );
}

fn run(
    app: &AppHandle,
    action: Fired,
    pressed: bool,
    context: &HotkeyContext,
    modes: OverlayModes,
) {
    let decl = match action {
        Fired::Declared(decl) => decl,
        Fired::Visibility(action_id) => return send_to_main(app, action_id),
    };

    debug!(action = decl.id, pressed, "hotkey");

    match decl.effect {
        HotkeyEffect::Pit(pit_action) => send_pit_action(app, pit_action),
        HotkeyEffect::PitAutoMode => app
            .state::<TelemetryState>()
            .service
            .send(TelemetryCommand::PitAuto(PitAutoCommand::ToggleAuto)),
        HotkeyEffect::View(control) => send_view_control(app, control),
        HotkeyEffect::ToggleDragMode => set_drag_mode(app, !modes.drag_mode),
        HotkeyEffect::InteractMode => {
            if let Some(on) = interact_after_key(modes, context.interact_hotkey_mode, pressed) {
                set_interact_mode(app, on);
            }
        }
        HotkeyEffect::Settings => send_to_main(app, decl.id.to_string()),
    }
}

fn send_pit_action(app: &AppHandle, action: PitAction) {
    app.state::<TelemetryState>()
        .service
        .send(TelemetryCommand::PitAction {
            action,
            issued_at: Instant::now(),
        });
}

/// Settings belong to the main window, so the key is all the dispatcher can
/// give it. While main is not running the action waits for nobody.
fn send_to_main(app: &AppHandle, action_id: String) {
    if let Err(error) = app.emit_to(
        MAIN_WINDOW_LABEL,
        EVENT_HOTKEY_SETTINGS_ACTION,
        HotkeySettingsAction { action_id },
    ) {
        warn!("hotkey: main window unreachable: {error}");
    }
}

/// To every overlay and every remote screen; each applies it to the instances
/// it holds that are marked for hotkeys.
fn send_view_control(app: &AppHandle, control: ViewControl) {
    let (kind, data) = match control {
        ViewControl::StandingsClassStep(step) => {
            (RemoteControlKind::StandingsClassStep, json!(step))
        }
        ViewControl::StandingsScroll(rows) => (RemoteControlKind::StandingsScroll, json!(rows)),
        ViewControl::StreamChatScroll(rows) => (RemoteControlKind::StreamChatScroll, json!(rows)),
        ViewControl::PitServiceToggle => (RemoteControlKind::PitServiceToggle, json!(null)),
    };

    // The message a remote screen receives over its socket, so an overlay
    // handles it in the same switch.
    let message = json!({ "type": kind.wire_name(), "data": data });

    for label in app.webview_windows().into_keys() {
        if label.starts_with(OVERLAY_LABEL_PREFIX) {
            if let Err(error) = app.emit_to(label.as_str(), EVENT_CLIENT_CONTROL, &message) {
                warn!(window = label, "hotkey: overlay unreachable: {error}");
            }
        }
    }

    // The hub drops the kinds that stay on the driver's screens.
    if let Some(remote) = app.try_state::<RemoteState>() {
        remote.hub.publish_control(kind.wire_name(), data);
    }
}

pub fn set_drag_mode(app: &AppHandle, on: bool) {
    let modes = {
        let mut inner = lock_or_recover(&state(app).inner);

        inner.modes = with_drag(inner.modes, on);

        if on {
            // Interact went off with it; a timer armed for it must not fire.
            inner.interact_generation += 1;
        }

        inner.modes
    };

    publish_modes(app, modes);
}

/// Interact mode lets the mouse reach the overlay, which means the game stops
/// receiving it — so switching it on arms a watchdog that switches it off.
pub fn set_interact_mode(app: &AppHandle, on: bool) {
    let (modes, generation, auto_off_seconds) = {
        let mut inner = lock_or_recover(&state(app).inner);

        inner.modes = with_interact(inner.modes, on);
        inner.interact_generation += 1;

        (
            inner.modes,
            inner.interact_generation,
            inner.context.interact_auto_off_seconds,
        )
    };

    publish_modes(app, modes);

    if on && auto_off_seconds.is_finite() && auto_off_seconds > 0.0 {
        arm_interact_auto_off(app.clone(), generation, auto_off_seconds);
    }
}

fn arm_interact_auto_off(app: AppHandle, generation: u64, seconds: f32) {
    let delay = Duration::from_millis((seconds * MS_PER_SECOND) as u64);

    let spawned = thread::Builder::new()
        .name("interact-auto-off".to_string())
        .spawn(move || {
            thread::sleep(delay);

            let expired = {
                let inner = lock_or_recover(&state(&app).inner);

                inner.interact_generation == generation && inner.modes.interact_mode
            };

            if expired {
                set_interact_mode(&app, false);
            }
        });

    if let Err(error) = spawned {
        warn!("hotkey: interact auto-off unavailable: {error}");
    }
}

fn publish_modes(app: &AppHandle, modes: OverlayModes) {
    if let Err(error) = app.emit(EVENT_OVERLAY_MODES, modes) {
        warn!("hotkey: failed to publish the overlay modes: {error}");
    }
}

/// Takes the main window's new context. A change of the interact key's mode
/// switches interact off — the key that would turn it off may now do
/// something else — and a new auto-off duration re-arms the watchdog.
pub fn set_context(app: &AppHandle, context: HotkeyContext) {
    let (mode_changed, timer_changed, interact_on) = {
        let mut inner = lock_or_recover(&state(app).inner);
        let previous = std::mem::replace(&mut inner.context, context);

        (
            previous.interact_hotkey_mode != inner.context.interact_hotkey_mode,
            previous.interact_auto_off_seconds != inner.context.interact_auto_off_seconds,
            inner.modes.interact_mode,
        )
    };

    if mode_changed {
        set_interact_mode(app, false);
    } else if timer_changed && interact_on {
        set_interact_mode(app, true);
    }
}

/// Takes the main window's binding map and brings the OS registrations in line
/// with it.
///
/// Keys stay registered across layout switches — the gate is checked per
/// press. Unregistering per layout would hand the key back to the sim
/// mid-session, which is worse than a press that does nothing.
///
/// Must not run on the main thread: the plugin registers there and waits.
pub fn set_bindings(app: &AppHandle, bindings: BindingMap) {
    let hotkeys = state(app);
    let _serialized = lock_or_recover(&hotkeys.registration);
    let wanted: BTreeSet<String> = keyboard_accelerators(&bindings).into_iter().collect();
    let registered = {
        let mut inner = lock_or_recover(&hotkeys.inner);

        inner.bindings = bindings;

        inner.registered.clone()
    };

    let shortcuts = app.global_shortcut();

    for accelerator in registered.difference(&wanted) {
        if let Err(error) = shortcuts.unregister(accelerator.as_str()) {
            warn!(accelerator, "hotkey: failed to unregister: {error}");
        }
    }

    let mut now_registered: BTreeSet<String> = registered.intersection(&wanted).cloned().collect();

    for accelerator in wanted.difference(&registered) {
        let binding = Binding::Keyboard {
            accelerator: accelerator.clone(),
        };
        let result = shortcuts.on_shortcut(accelerator.as_str(), move |app, _, event| {
            on_binding_edge(app, &binding, event.state == ShortcutState::Pressed);
        });

        match result {
            Ok(()) => {
                now_registered.insert(accelerator.clone());
            }
            Err(error) => warn!(accelerator, "hotkey: failed to register: {error}"),
        }
    }

    info!(keys = now_registered.len(), "hotkey bindings applied");

    lock_or_recover(&hotkeys.inner).registered = now_registered;
}
