//! Which demand-gated fields each recipient is asking for.
//!
//! There used to be one number: main unioned the `telemetryEvents` of every
//! enabled widget and the backend stored it in a single atomic. That describes
//! what the *layout* wants and nothing describes what a *window* wants, so a
//! monitor showing only a fuel widget still pays the IPC hop for the per-car
//! frames a widget on the other monitor asked for.
//!
//! This is the registry that gives the appetite an owner: `label -> mask`,
//! keyed by the window label the command derived from its caller. The emitter
//! keeps reading one number — the union — so with a single registrant the app
//! behaves exactly as it did.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

use crate::utils::lock_or_recover;

/// The remote screens' appetite, which belongs to no window.
///
/// `mirror.rs` taps the global event stream rather than holding a webview, so
/// the browsers on the LAN have no label of their own to register under. The
/// prefix is deliberately a character Tauri does not accept in a window label
/// (and that `monitorLabel` in `platform/sync/overlay-labels.ts` strips), so it
/// can never collide with a real one.
pub const REMOTE_LABEL: &str = "@remote";

/// The appetite the app starts with, before any window has said what it wants.
///
/// It asks for everything, which is what the single atomic this registry
/// replaced was initialised to: a bundle assembled between the telemetry
/// thread starting and the first registration arriving must not be stripped of
/// fields, or a window restoring its listener paints nothing until the next
/// layout change. It is dropped by the first real registration and can never
/// come back — see `register`.
pub const BOOTSTRAP_LABEL: &str = "@bootstrap";

/// Every recipient's mask, plus the union the emitter reads.
///
/// The union is cached on write rather than computed on read: the emitter reads
/// it sixty times a second and registration happens when a layout changes.
pub struct MaskRegistry {
    masks: Mutex<HashMap<String, u32>>,
    effective: AtomicU32,
}

impl Default for MaskRegistry {
    fn default() -> Self {
        Self {
            masks: Mutex::new(HashMap::new()),
            effective: AtomicU32::new(0),
        }
    }
}

impl MaskRegistry {
    /// The registry the app boots with: everything on, under a label the first
    /// real registrant takes away.
    pub fn bootstrapped() -> Self {
        let registry = Self::default();

        registry.register(BOOTSTRAP_LABEL, u32::MAX);

        registry
    }
}

impl MaskRegistry {
    /// Records a recipient's appetite, replacing whatever it asked for before.
    /// A window that reloads re-registers under the same label and so takes its
    /// entry back rather than adding a second one.
    pub fn register(&self, label: &str, mask: u32) {
        let mut masks = lock_or_recover(&self.masks);

        if label != BOOTSTRAP_LABEL {
            masks.remove(BOOTSTRAP_LABEL);
        }

        masks.insert(label.to_owned(), mask);
        self.recompute(&masks);
    }

    /// Forgets a recipient. Called when a window is destroyed — a closed window
    /// must not keep a field switched on for everyone else.
    pub fn drop_label(&self, label: &str) {
        let mut masks = lock_or_recover(&self.masks);

        if masks.remove(label).is_none() {
            return;
        }

        self.recompute(&masks);
    }

    /// The union of every registered mask: what the emitter has to fill in.
    /// Lock-free, because it is read on every tick.
    pub fn effective_mask(&self) -> u32 {
        self.effective.load(Ordering::Relaxed)
    }

    /// Every recipient's own mask. Ticket 04 groups by these values; for now it
    /// is what the tests and the logs read.
    #[allow(dead_code)]
    pub fn entries(&self) -> Vec<(String, u32)> {
        let mut entries: Vec<(String, u32)> = lock_or_recover(&self.masks)
            .iter()
            .map(|(label, mask)| (label.clone(), *mask))
            .collect();

        entries.sort_by(|left, right| left.0.cmp(&right.0));

        entries
    }

    fn recompute(&self, masks: &HashMap<String, u32>) {
        let union = masks.values().fold(0, |union, mask| union | mask);

        self.effective.store(union, Ordering::Relaxed);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::telemetry::state::{EVENT_CAR_DYNAMICS, EVENT_CAR_INPUTS, EVENT_PROXIMITY};

    /// Nothing is stripped from a bundle assembled before the first window has
    /// registered, which is what the atomic this replaced did with 0xFFFFFFFF.
    #[test]
    fn the_bootstrap_entry_asks_for_everything_and_the_first_registrant_ends_it() {
        let registry = MaskRegistry::bootstrapped();

        assert_eq!(registry.effective_mask(), u32::MAX);

        registry.register("overlay-left", EVENT_CAR_DYNAMICS);

        assert_eq!(registry.effective_mask(), EVENT_CAR_DYNAMICS);

        registry.drop_label("overlay-left");

        assert_eq!(registry.effective_mask(), 0);
    }

    #[test]
    fn an_empty_registry_asks_for_nothing() {
        assert_eq!(MaskRegistry::default().effective_mask(), 0);
    }

    #[test]
    fn unions_what_every_label_asked_for() {
        let registry = MaskRegistry::default();

        registry.register("overlay-left", EVENT_CAR_DYNAMICS);
        registry.register("overlay-right", EVENT_PROXIMITY);

        assert_eq!(
            registry.effective_mask(),
            EVENT_CAR_DYNAMICS | EVENT_PROXIMITY
        );
    }

    #[test]
    fn dropping_one_label_leaves_the_others_bits() {
        let registry = MaskRegistry::default();

        registry.register("overlay-left", EVENT_CAR_DYNAMICS);
        registry.register("overlay-right", EVENT_PROXIMITY);
        registry.drop_label("overlay-left");

        assert_eq!(registry.effective_mask(), EVENT_PROXIMITY);
    }

    #[test]
    fn dropping_the_last_label_leaves_nothing() {
        let registry = MaskRegistry::default();

        registry.register("overlay-left", EVENT_CAR_DYNAMICS);
        registry.drop_label("overlay-left");

        assert_eq!(registry.effective_mask(), 0);
    }

    #[test]
    fn dropping_an_unknown_label_changes_nothing() {
        let registry = MaskRegistry::default();

        registry.register("overlay-left", EVENT_CAR_DYNAMICS);
        registry.drop_label("overlay-never-opened");

        assert_eq!(registry.effective_mask(), EVENT_CAR_DYNAMICS);
    }

    /// A reload re-registers under the same label: the entry is replaced, not
    /// accumulated, so a window that stops drawing a widget stops paying for it.
    #[test]
    fn re_registering_replaces_rather_than_accumulates() {
        let registry = MaskRegistry::default();

        registry.register("overlay-left", EVENT_CAR_DYNAMICS);
        registry.register("overlay-left", EVENT_CAR_INPUTS);

        assert_eq!(registry.effective_mask(), EVENT_CAR_INPUTS);
        assert_eq!(registry.entries().len(), 1);
    }

    /// A reload keeps the mask (same label registers again); a close takes it
    /// away. The two are the same registry call and a `drop_label` apart, which
    /// is the whole difference the `Destroyed` hook makes.
    #[test]
    fn a_reload_keeps_the_mask_and_a_close_does_not() {
        let registry = MaskRegistry::default();

        registry.register("overlay-left", EVENT_CAR_DYNAMICS);
        registry.register("overlay-left", EVENT_CAR_DYNAMICS);

        assert_eq!(registry.effective_mask(), EVENT_CAR_DYNAMICS);

        registry.drop_label("overlay-left");

        assert_eq!(registry.effective_mask(), 0);
    }

    /// `monitorLabel` slugs a monitor name to `overlay-` plus alphanumerics,
    /// `-` and `_`. Whatever the OS calls a screen, it cannot come out as the
    /// pseudo-label the remote screens are registered under.
    #[test]
    fn no_monitor_name_can_produce_the_remote_label() {
        let slug_safe = |candidate: &str| {
            candidate.chars().all(|character| {
                character.is_ascii_alphanumeric() || character == '-' || character == '_'
            })
        };

        assert!(!slug_safe(REMOTE_LABEL));
        assert!(!slug_safe(BOOTSTRAP_LABEL));
        assert!(!REMOTE_LABEL.starts_with("overlay-"));
        assert!(!BOOTSTRAP_LABEL.starts_with("overlay-"));
    }
}
