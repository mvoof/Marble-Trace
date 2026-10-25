//! The dispatcher's state and the side effects of a fired action.
//!
//! A sim action goes to the telemetry thread, a view action straight to the
//! overlays and the remote screens, and only a settings action needs the main
//! window — which owns the settings it writes. So acting on the car does not
//! depend on any webview being alive, unpaused or fed the right frames.
//!
//! The overlay's drag and interact modes live here too: their keys are the most
//! pressed of all, and the state is the dispatcher's to hold rather than one
//! window's to broadcast.

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde_json::json;
use tracing::{debug, info, warn};

use crate::dispatch::{fired_actions, keyboard_accelerators, BindingMap, Fired};
use crate::modes::{interact_after_key, with_drag, with_interact};
use mt_computations::strategy::pit_auto::PitAutoCommand;
use mt_model::app::hotkeys::{
    Binding, HotkeyContext, HotkeyEffect, HotkeySettingsAction, OverlayModes, ViewControl,
};
use mt_model::app::input::InputButtonEvent;
use mt_model::contract::event_sink::EventSink;
use mt_model::contract::events::{
    RemoteControlKind, WireName, EVENT_CLIENT_CONTROL, EVENT_HOTKEY_SETTINGS_ACTION,
    EVENT_OVERLAY_MODES,
};
use mt_model::contract::windows::MAIN_WINDOW_LABEL;
use mt_model::pit::pit_action::PitAction;
use mt_model::utils::lock_or_recover;
use mt_remote::hub::RemoteHub;
use mt_telemetry::control::TelemetryCommand;
use mt_telemetry::state::TelemetryServiceState;

const MS_PER_SECOND: f32 = 1000.0;

/// Called with `true` when the key goes down and `false` when it comes up.
pub type KeyEdge = Box<dyn Fn(bool) + Send + Sync>;

/// The OS's global shortcuts, as the app reaches them.
pub trait KeyRegistrar: Send + Sync {
    fn register(&self, accelerator: &str, on_edge: KeyEdge) -> Result<(), String>;
    fn unregister(&self, accelerator: &str) -> Result<(), String>;
}

/// The labels of the overlay windows open right now.
pub type OverlayLabels = Box<dyn Fn() -> Vec<String> + Send + Sync>;

/// What the dispatcher needs from the app.
pub struct HotkeyHost {
    pub sink: Arc<dyn EventSink>,
    pub telemetry: Arc<TelemetryServiceState>,
    pub remote: Arc<RemoteHub>,
    pub overlay_labels: OverlayLabels,
    pub keys: Box<dyn KeyRegistrar>,
}

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

pub struct HotkeyRuntime {
    host: HotkeyHost,
    inner: Mutex<Inner>,
    /// Held across a whole re-registration, so two pushes in quick succession
    /// cannot interleave their unregister and register calls.
    registration: Mutex<()>,
}

impl HotkeyRuntime {
    pub fn new(host: HotkeyHost) -> Arc<Self> {
        Arc::new(Self {
            host,
            inner: Mutex::default(),
            registration: Mutex::default(),
        })
    }

    pub fn modes(&self) -> OverlayModes {
        lock_or_recover(&self.inner).modes
    }

    /// A binding went down or up: run what it fires.
    pub fn on_binding_edge(self: &Arc<Self>, binding: &Binding, pressed: bool) {
        let (fired, context, modes) = {
            let inner = lock_or_recover(&self.inner);

            (
                fired_actions(&inner.bindings, binding, pressed, &inner.context),
                inner.context.clone(),
                inner.modes,
            )
        };

        for action in fired {
            self.run(action, pressed, &context, modes);
        }
    }

    /// The DirectInput poll thread's edges, handed in by the app.
    pub fn on_device_edge(self: &Arc<Self>, edge: &InputButtonEvent) {
        self.on_binding_edge(
            &Binding::Device {
                device_id: edge.device_id.clone(),
                button: edge.button,
            },
            edge.pressed,
        );
    }

    fn run(
        self: &Arc<Self>,
        action: Fired,
        pressed: bool,
        context: &HotkeyContext,
        modes: OverlayModes,
    ) {
        let decl = match action {
            Fired::Declared(decl) => decl,
            Fired::Visibility(action_id) => return self.send_to_main(action_id),
        };

        debug!(action = decl.id, pressed, "hotkey");

        match decl.effect {
            HotkeyEffect::Pit(pit_action) => self.send_pit_action(pit_action),
            HotkeyEffect::PitAutoMode => self
                .host
                .telemetry
                .send(TelemetryCommand::PitAuto(PitAutoCommand::ToggleAuto)),
            HotkeyEffect::View(control) => self.send_view_control(control),
            HotkeyEffect::ToggleDragMode => self.set_drag_mode(!modes.drag_mode),
            HotkeyEffect::InteractMode => {
                if let Some(on) = interact_after_key(modes, context.interact_hotkey_mode, pressed) {
                    self.set_interact_mode(on);
                }
            }
            HotkeyEffect::Settings => self.send_to_main(decl.id.to_string()),
        }
    }

    fn send_pit_action(&self, action: PitAction) {
        self.host.telemetry.send(TelemetryCommand::PitAction {
            action,
            issued_at: Instant::now(),
        });
    }

    /// Settings belong to the main window, so the key is all the dispatcher can
    /// give it. While main is not running the action waits for nobody.
    fn send_to_main(&self, action_id: String) {
        let sink = self.host.sink.as_ref();

        if let Err(error) = sink.emit_to(
            MAIN_WINDOW_LABEL,
            EVENT_HOTKEY_SETTINGS_ACTION,
            &HotkeySettingsAction { action_id },
        ) {
            warn!("hotkey: main window unreachable: {error}");
        }
    }

    /// To every overlay and every remote screen; each applies it to the
    /// instances it holds that are marked for hotkeys.
    fn send_view_control(&self, control: ViewControl) {
        let (kind, data) = match control {
            ViewControl::StandingsClassStep(step) => {
                (RemoteControlKind::StandingsClassStep, json!(step))
            }
            ViewControl::StandingsScroll(rows) => (RemoteControlKind::StandingsScroll, json!(rows)),
            ViewControl::StreamChatScroll(rows) => {
                (RemoteControlKind::StreamChatScroll, json!(rows))
            }
            ViewControl::PitServiceToggle => (RemoteControlKind::PitServiceToggle, json!(null)),
        };

        // The message a remote screen receives over its socket, so an overlay
        // handles it in the same switch.
        let message = json!({ "type": kind.wire_name(), "data": data });
        let sink = self.host.sink.as_ref();

        for label in (self.host.overlay_labels)() {
            if let Err(error) = sink.emit_to(&label, EVENT_CLIENT_CONTROL, &message) {
                warn!(window = label, "hotkey: overlay unreachable: {error}");
            }
        }

        // The hub drops the kinds that stay on the driver's screens.
        self.host.remote.publish_control(kind.wire_name(), data);
    }

    pub fn set_drag_mode(&self, on: bool) {
        let modes = {
            let mut inner = lock_or_recover(&self.inner);

            inner.modes = with_drag(inner.modes, on);

            if on {
                // Interact went off with it; a timer armed for it must not fire.
                inner.interact_generation += 1;
            }

            inner.modes
        };

        self.publish_modes(modes);
    }

    /// Interact mode lets the mouse reach the overlay, which means the game
    /// stops receiving it — so switching it on arms a watchdog that switches
    /// it off.
    pub fn set_interact_mode(self: &Arc<Self>, on: bool) {
        let (modes, generation, auto_off_seconds) = {
            let mut inner = lock_or_recover(&self.inner);

            inner.modes = with_interact(inner.modes, on);
            inner.interact_generation += 1;

            (
                inner.modes,
                inner.interact_generation,
                inner.context.interact_auto_off_seconds,
            )
        };

        self.publish_modes(modes);

        if on && auto_off_seconds.is_finite() && auto_off_seconds > 0.0 {
            self.arm_interact_auto_off(generation, auto_off_seconds);
        }
    }

    fn arm_interact_auto_off(self: &Arc<Self>, generation: u64, seconds: f32) {
        let delay = Duration::from_millis((seconds * MS_PER_SECOND) as u64);
        let runtime = Arc::downgrade(self);

        let spawned = thread::Builder::new()
            .name("interact-auto-off".to_string())
            .spawn(move || {
                thread::sleep(delay);

                let Some(runtime) = runtime.upgrade() else {
                    return;
                };
                let expired = {
                    let inner = lock_or_recover(&runtime.inner);

                    inner.interact_generation == generation && inner.modes.interact_mode
                };

                if expired {
                    runtime.set_interact_mode(false);
                }
            });

        if let Err(error) = spawned {
            warn!("hotkey: interact auto-off unavailable: {error}");
        }
    }

    fn publish_modes(&self, modes: OverlayModes) {
        if let Err(error) = self.host.sink.as_ref().emit(EVENT_OVERLAY_MODES, &modes) {
            warn!("hotkey: failed to publish the overlay modes: {error}");
        }
    }

    /// Takes the main window's new context. A change of the interact key's
    /// mode switches interact off — the key that would turn it off may now do
    /// something else — and a new auto-off duration re-arms the watchdog.
    pub fn set_context(self: &Arc<Self>, context: HotkeyContext) {
        let (mode_changed, timer_changed, interact_on) = {
            let mut inner = lock_or_recover(&self.inner);
            let previous = std::mem::replace(&mut inner.context, context);

            (
                previous.interact_hotkey_mode != inner.context.interact_hotkey_mode,
                previous.interact_auto_off_seconds != inner.context.interact_auto_off_seconds,
                inner.modes.interact_mode,
            )
        };

        if mode_changed {
            self.set_interact_mode(false);
        } else if timer_changed && interact_on {
            self.set_interact_mode(true);
        }
    }

    /// Takes the main window's binding map and brings the OS registrations in
    /// line with it.
    ///
    /// Keys stay registered across layout switches — the gate is checked per
    /// press. Unregistering per layout would hand the key back to the sim
    /// mid-session, which is worse than a press that does nothing.
    ///
    /// Must not run on the main thread: the plugin registers there and waits.
    pub fn set_bindings(self: &Arc<Self>, bindings: BindingMap) {
        let _serialized = lock_or_recover(&self.registration);
        let wanted: BTreeSet<String> = keyboard_accelerators(&bindings).into_iter().collect();
        let registered = {
            let mut inner = lock_or_recover(&self.inner);

            inner.bindings = bindings;

            inner.registered.clone()
        };

        for accelerator in registered.difference(&wanted) {
            if let Err(error) = self.host.keys.unregister(accelerator) {
                warn!(accelerator, "hotkey: failed to unregister: {error}");
            }
        }

        let mut now_registered: BTreeSet<String> =
            registered.intersection(&wanted).cloned().collect();

        for accelerator in wanted.difference(&registered) {
            let result = self
                .host
                .keys
                .register(accelerator, self.key_edge(accelerator));

            match result {
                Ok(()) => {
                    now_registered.insert(accelerator.clone());
                }
                Err(error) => warn!(accelerator, "hotkey: failed to register: {error}"),
            }
        }

        info!(keys = now_registered.len(), "hotkey bindings applied");

        lock_or_recover(&self.inner).registered = now_registered;
    }

    /// Weak, like the auto-off timer: the runtime holds the shortcut plugin
    /// through `host.keys`, so a strong callback would keep both alive forever.
    fn key_edge(self: &Arc<Self>, accelerator: &str) -> KeyEdge {
        let runtime = Arc::downgrade(self);
        let binding = Binding::Keyboard {
            accelerator: accelerator.to_string(),
        };

        Box::new(move |pressed| {
            if let Some(runtime) = runtime.upgrade() {
                runtime.on_binding_edge(&binding, pressed);
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use mt_model::app::hotkeys::InteractHotkeyMode;

    #[derive(Default)]
    struct RecordingSink {
        events: Mutex<Vec<(Option<String>, String)>>,
    }

    impl EventSink for RecordingSink {
        fn emit_json(&self, event: &str, _payload: String) -> Result<(), String> {
            lock_or_recover(&self.events).push((None, event.to_string()));

            Ok(())
        }

        fn emit_json_to(&self, label: &str, event: &str, _payload: String) -> Result<(), String> {
            lock_or_recover(&self.events).push((Some(label.to_string()), event.to_string()));

            Ok(())
        }
    }

    #[derive(Default)]
    struct RecordingKeys {
        registered: Arc<Mutex<BTreeSet<String>>>,
    }

    impl KeyRegistrar for RecordingKeys {
        fn register(&self, accelerator: &str, _on_edge: KeyEdge) -> Result<(), String> {
            lock_or_recover(&self.registered).insert(accelerator.to_string());

            Ok(())
        }

        fn unregister(&self, accelerator: &str) -> Result<(), String> {
            lock_or_recover(&self.registered).remove(accelerator);

            Ok(())
        }
    }

    fn runtime(sink: Arc<RecordingSink>, keys: RecordingKeys) -> Arc<HotkeyRuntime> {
        HotkeyRuntime::new(HotkeyHost {
            sink,
            telemetry: Arc::default(),
            remote: Arc::default(),
            overlay_labels: Box::new(|| vec!["overlay-1".to_string()]),
            keys: Box::new(keys),
        })
    }

    fn keyboard(accelerator: &str) -> Binding {
        Binding::Keyboard {
            accelerator: accelerator.to_string(),
        }
    }

    #[test]
    fn bindings_register_only_the_difference() {
        let keys = RecordingKeys::default();
        let registered = Arc::clone(&keys.registered);
        let hotkeys = runtime(Arc::default(), keys);

        let first = BindingMap::from([
            ("pit.fuel".to_string(), vec![keyboard("F5")]),
            ("view.drag".to_string(), vec![keyboard("F6")]),
        ]);
        hotkeys.set_bindings(first);

        let second = BindingMap::from([("pit.fuel".to_string(), vec![keyboard("F7")])]);
        hotkeys.set_bindings(second);

        assert_eq!(
            *lock_or_recover(&registered),
            BTreeSet::from(["F7".to_string()])
        );
    }

    #[test]
    fn a_new_interact_key_mode_switches_interact_off() {
        let sink = Arc::new(RecordingSink::default());
        let hotkeys = runtime(Arc::clone(&sink), RecordingKeys::default());

        hotkeys.set_interact_mode(true);
        assert!(hotkeys.modes().interact_mode);

        let context = HotkeyContext {
            interact_hotkey_mode: InteractHotkeyMode::Hold,
            ..HotkeyContext::default()
        };
        hotkeys.set_context(context);

        assert!(!hotkeys.modes().interact_mode);
        assert!(lock_or_recover(&sink.events)
            .iter()
            .all(|(label, event)| label.is_none() && event == EVENT_OVERLAY_MODES));
    }
}
