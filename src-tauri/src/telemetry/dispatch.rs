//! Who gets which bundle.
//!
//! The emitter used to broadcast one bundle to every webview, filled from the
//! union of everyone's appetite. With a mask per window that union is exactly
//! what we are trying to stop sending: a monitor showing a fuel widget should
//! not pay the IPC hop for the per-car frames a widget on the *other* monitor
//! asked for.
//!
//! So the registry is grouped by the **value** of the mask. One bundle is built
//! and serialized per distinct value and delivered to every label in that
//! group. When every window wants the same thing — one monitor, or two similar
//! layouts, which is the common case — there is one group and the app does
//! exactly what it did before.

use std::collections::HashMap;

use super::delivery::BROADCAST_LABEL;
use super::emitter::TelemetryBundle;
use super::masks::{BOOTSTRAP_LABEL, REMOTE_LABEL};

/// Where one bundle has to go.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Recipient {
    /// A real webview, reached with `emit_to`.
    Window(String),
    /// Every subscribed webview at once. Only the bootstrap entry produces
    /// this: before any window has registered there is no label to aim at, and
    /// a bundle stripped of fields would leave a window that restored its
    /// listener painting nothing. The first real registration takes the
    /// bootstrap entry away (`MaskRegistry::register`), so a broadcast group
    /// and a window group do not coexist.
    Broadcast,
    /// The remote screens. They hold no webview here — `remote/mirror.rs` taps
    /// the event stream — so their bundle goes out on an internal event the tap
    /// listens for.
    Mirror,
}

impl Recipient {
    /// The label this recipient is counted under in the delivery counters.
    pub fn label(&self) -> &str {
        match self {
            Recipient::Window(label) => label,
            Recipient::Broadcast => BROADCAST_LABEL,
            Recipient::Mirror => REMOTE_LABEL,
        }
    }
}

/// One serialization's worth of work: the mask to fill a bundle from, and
/// everyone who asked for exactly that.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeliveryGroup {
    pub mask: u32,
    pub recipients: Vec<Recipient>,
}

/// Groups the registry by mask value.
///
/// Sorted by mask so the order is stable across ticks — the emitter hands the
/// last group its bundle by value instead of cloning it, and a wobbling order
/// would move that saving around at random.
pub fn plan(entries: Vec<(String, u32)>) -> Vec<DeliveryGroup> {
    let mut by_mask: HashMap<u32, Vec<Recipient>> = HashMap::new();

    for (label, mask) in entries {
        let recipient = match label.as_str() {
            REMOTE_LABEL => Recipient::Mirror,
            BOOTSTRAP_LABEL => Recipient::Broadcast,
            _ => Recipient::Window(label),
        };

        by_mask.entry(mask).or_default().push(recipient);
    }

    let mut groups: Vec<DeliveryGroup> = by_mask
        .into_iter()
        .map(|(mask, mut recipients)| {
            recipients.sort_by(|left, right| left.label().cmp(right.label()));

            DeliveryGroup { mask, recipients }
        })
        .collect();

    groups.sort_by_key(|group| group.mask);

    groups
}

/// Whether this group's bundle must also go out on the internal mirror event.
///
/// **Temporary — the second half of spec decision 6.** The remote screens still
/// arrive through `app.listen` in `remote/mirror.rs`, which `emit_to` does not
/// feed, so the group holding their appetite is re-emitted on an event the tap
/// can see. The follow-up is "move the mirror to `emit_to`", named as out of
/// scope in `.scratch/per-window-telemetry-mask/spec.md`; when it lands this
/// function and the internal event go with it.
///
/// A silent mirror is this design's failure mode — nothing logs when the tap
/// stops receiving, the remote screens simply go stale — so every state the
/// registry can be in feeds it something:
///
/// 1. The remote screens have registered: their own group, and only that one.
/// 2. Nobody has registered yet: the bootstrap group, which broadcasts
///    everything, exactly as the single `app.emit` used to.
/// 3. **The gap.** A window registers before main has registered the remote
///    appetite — main does so on its first reaction, but the overlay may get
///    there first — and the bootstrap entry is already gone, taken away by that
///    window. There is then no mirror group and no broadcast group, and without
///    this last case the tap would be fed nothing at all for as long as the gap
///    lasts. The widest group stands in: the most fields any window is being
///    sent, which is the closest thing to what the remote screens are about to
///    ask for.
pub fn mirrors(groups: &[DeliveryGroup], group: &DeliveryGroup) -> bool {
    let has_mirror = |candidate: &DeliveryGroup| candidate.recipients.contains(&Recipient::Mirror);

    if groups.iter().any(has_mirror) {
        return has_mirror(group);
    }

    if groups
        .iter()
        .any(|candidate| candidate.recipients.contains(&Recipient::Broadcast))
    {
        return group.recipients.contains(&Recipient::Broadcast);
    }

    // Ties go to the larger mask, so exactly one group is chosen however the
    // registry is shaped.
    groups
        .iter()
        .max_by_key(|candidate| (candidate.mask.count_ones(), candidate.mask))
        .is_some_and(|widest| widest.mask == group.mask)
}

/// Where a delivered bundle actually goes.
///
/// A seam rather than a call to `AppHandle` in place, because the one failure
/// this design can produce silently is a bundle that reaches no mirror: nothing
/// logs when `remote/mirror.rs` stops receiving, the remote screens simply go
/// stale. With the transport behind this trait, the grouping can be driven in a
/// unit test and the mirror asserted on.
pub trait BundleSink {
    fn to_window(&mut self, label: &str, bundle: &TelemetryBundle);
    fn broadcast(&mut self, bundle: &TelemetryBundle);
    /// The temporary half of spec decision 6 — see [`mirrors`].
    fn to_mirror(&mut self, bundle: &TelemetryBundle);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::telemetry::state::{EVENT_CAR_DYNAMICS, EVENT_PROXIMITY};

    fn window(label: &str) -> Recipient {
        Recipient::Window(label.to_owned())
    }

    /// The common case: every window wants the same fields, so there is one
    /// serialization. If this ever split, the feature would cost most users
    /// more than it saves them.
    #[test]
    fn identical_masks_collapse_to_one_group() {
        let groups = plan(vec![
            ("overlay-left".into(), EVENT_CAR_DYNAMICS),
            ("overlay-right".into(), EVENT_CAR_DYNAMICS),
        ]);

        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].mask, EVENT_CAR_DYNAMICS);
        assert_eq!(
            groups[0].recipients,
            vec![window("overlay-left"), window("overlay-right")]
        );
    }

    #[test]
    fn different_masks_are_served_separately() {
        let groups = plan(vec![
            ("overlay-left".into(), EVENT_PROXIMITY),
            ("overlay-right".into(), EVENT_CAR_DYNAMICS),
        ]);

        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].mask, EVENT_CAR_DYNAMICS);
        assert_eq!(groups[0].recipients, vec![window("overlay-right")]);
        assert_eq!(groups[1].mask, EVENT_PROXIMITY);
        assert_eq!(groups[1].recipients, vec![window("overlay-left")]);
    }

    /// The pseudo-labels are ordinary members of the grouping — the remote
    /// screens share a serialization with any window that wants the same
    /// fields, and only the transport differs.
    #[test]
    fn the_remote_label_groups_with_a_window_that_asks_for_the_same() {
        let groups = plan(vec![
            ("overlay-left".into(), EVENT_CAR_DYNAMICS),
            (REMOTE_LABEL.into(), EVENT_CAR_DYNAMICS),
        ]);

        assert_eq!(groups.len(), 1);
        assert_eq!(
            groups[0].recipients,
            vec![Recipient::Mirror, window("overlay-left")]
        );
        assert!(mirrors(&groups, &groups[0]));
    }

    #[test]
    fn only_the_remote_groups_bundle_reaches_the_tap() {
        let groups = plan(vec![
            ("overlay-left".into(), EVENT_CAR_DYNAMICS),
            (REMOTE_LABEL.into(), EVENT_PROXIMITY),
        ]);

        assert!(!mirrors(&groups, &groups[0]));
        assert!(mirrors(&groups, &groups[1]));
    }

    /// Before any window registers there is no remote appetite either, and the
    /// tap still has to be fed or the remote screens paint nothing until the
    /// first layout change.
    #[test]
    fn the_bootstrap_group_broadcasts_and_feeds_the_tap() {
        let groups = plan(vec![(BOOTSTRAP_LABEL.into(), u32::MAX)]);

        assert_eq!(groups[0].recipients, vec![Recipient::Broadcast]);
        assert!(mirrors(&groups, &groups[0]));
    }

    /// The gap between a window registering — which takes the bootstrap entry
    /// away — and main registering the remote appetite. Nothing holds the
    /// mirror and nothing broadcasts, and the tap must still be fed.
    #[test]
    fn the_widest_group_feeds_the_tap_while_no_remote_appetite_is_registered() {
        let groups = plan(vec![
            ("overlay-left".into(), EVENT_CAR_DYNAMICS | EVENT_PROXIMITY),
            ("overlay-right".into(), EVENT_CAR_DYNAMICS),
        ]);

        let fed: Vec<bool> = groups.iter().map(|group| mirrors(&groups, group)).collect();

        assert_eq!(
            fed.iter().filter(|mirrored| **mirrored).count(),
            1,
            "exactly one group feeds the tap, never two and never none"
        );
        assert!(
            mirrors(&groups, &groups[1]),
            "the widest group is the closest thing to what the remote screens will ask for"
        );
    }

    /// And the moment the remote screens do register, the fallback stops: they
    /// are fed their own appetite, not somebody else's.
    #[test]
    fn a_registered_remote_appetite_ends_the_fallback() {
        let groups = plan(vec![
            ("overlay-left".into(), EVENT_CAR_DYNAMICS | EVENT_PROXIMITY),
            (REMOTE_LABEL.into(), EVENT_CAR_DYNAMICS),
        ]);

        assert!(!mirrors(&groups, &groups[1]), "not the widest group");
        assert!(
            mirrors(&groups, &groups[0]),
            "the remote screens' own group"
        );
    }

    #[test]
    fn an_empty_registry_has_nothing_to_send() {
        assert!(plan(vec![]).is_empty());
    }

    #[test]
    fn recipients_are_counted_under_their_own_labels() {
        assert_eq!(window("overlay-left").label(), "overlay-left");
        assert_eq!(Recipient::Broadcast.label(), BROADCAST_LABEL);
        assert_eq!(Recipient::Mirror.label(), REMOTE_LABEL);
    }
}
