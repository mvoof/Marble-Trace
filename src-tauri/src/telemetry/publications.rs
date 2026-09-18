//! Remembers what was last published, so an unchanged frame can be left out of
//! the bundle instead of sent again.
//!
//! This is only worth anything downstream of [`super::quantize`]: raw simulator
//! floats are never bit-identical two ticks running, so nothing would ever
//! compare equal. Once rounded to what a widget can actually draw, a car parked
//! in the pit box produces the same frame over and over, and every one of those
//! after the first is pure waste — a serialization, an IPC hop into each window
//! and remote screen, a parse, and a store write that wakes observers to redraw
//! an identical picture.
//!
//! The comparison is a `PartialEq` over the frame, which costs a walk of the
//! per-car vectors. That is one to two orders of magnitude cheaper than the
//! serialization it avoids, and it is paid once in the backend rather than once
//! per window.
//!
//! ## Why a full bundle is forced periodically
//!
//! A field held back is a field a *newcomer* never sees: an overlay window that
//! reloads, or a phone opening a remote screen mid-session, starts with empty
//! stores and would stay empty until something happened to change. Forcing every
//! field through on the 1 Hz tier bounds that blindness to one second, which is
//! below what anyone notices on a screen that is just being opened, and costs a
//! single full bundle per second.

use std::collections::HashMap;

use crate::computations::driver_entries::DriverEntriesFrame;
use crate::computations::proximity::ProximityFrame;
use crate::model::cars::{CarIdxFrame, CarPositionsFrame};
use crate::model::relative::RelativeFrame;
use crate::telemetry::emitter::TelemetryBundle;

/// The last published copy of every frame that may be held back.
#[derive(Default)]
pub struct Publications {
    car_positions: Option<CarPositionsFrame>,
    car_idx: Option<CarIdxFrame>,
    driver_entries: Option<DriverEntriesFrame>,
    relative: Option<RelativeFrame>,
    proximity: Option<ProximityFrame>,
}

/// Clears `field` when it is equal to what was published last, and records it
/// otherwise. `force` keeps the field regardless and refreshes the record —
/// the periodic full bundle.
fn take_if_changed<T: Clone + PartialEq>(field: &mut Option<T>, last: &mut Option<T>, force: bool) {
    let Some(value) = field.as_ref() else {
        return;
    };

    if !force && last.as_ref() == Some(value) {
        *field = None;

        return;
    }

    *last = Some(value.clone());
}

impl Publications {
    /// Drops from `bundle` every frame identical to the one published before it.
    ///
    /// Call *after* quantization and after demand gating: a field the mask
    /// already removed must not be recorded as published, or re-enabling its
    /// widget would wait for the next real change.
    pub fn prune(&mut self, bundle: &mut TelemetryBundle, force: bool) {
        take_if_changed(&mut bundle.car_positions, &mut self.car_positions, force);
        take_if_changed(&mut bundle.car_idx, &mut self.car_idx, force);
        take_if_changed(&mut bundle.driver_entries, &mut self.driver_entries, force);
        take_if_changed(&mut bundle.relative, &mut self.relative, force);
        take_if_changed(&mut bundle.proximity, &mut self.proximity, force);
    }
}

/// One publication record per delivery group, keyed by the **value** of the
/// group's mask.
///
/// With one recipient there was one record. With groups there has to be one
/// each, or a window whose group is new is muted by what a *different* group
/// was sent: the fields it needs were already published — to somebody else —
/// and would be held back until they happened to change.
///
/// Keyed by mask rather than by the set of labels, so a widget dragged from one
/// monitor to another lands in a group that already exists and keeps its
/// record, instead of restarting it.
#[derive(Default)]
pub struct PublicationRegistry {
    records: HashMap<u32, Publications>,
}

impl PublicationRegistry {
    /// Prunes `bundle` against the record for `mask`. A mask seen for the first
    /// time gets a full bundle — the same guarantee the 1 Hz tier gives a
    /// reloaded window, and it must not depend on what another group was sent.
    pub fn prune(&mut self, mask: u32, bundle: &mut TelemetryBundle, force: bool) {
        let record = self.records.entry(mask);
        let first_tick = matches!(record, std::collections::hash_map::Entry::Vacant(_));

        record.or_default().prune(bundle, force || first_tick);
    }

    /// Forgets the records of groups that no longer exist, so a mask nobody
    /// asks for any more is not carried for the rest of the session.
    pub fn retain(&mut self, live: &[u32]) {
        self.records.retain(|mask, _| live.contains(mask));
    }

    /// Forgets everything: a reconnect or a session change resets the windows'
    /// stores too, so every group needs a full bundle again.
    pub fn reset(&mut self) {
        self.records.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn positions(pct: f32) -> CarPositionsFrame {
        CarPositionsFrame {
            car_idx_lap_dist_pct: vec![pct],
            car_idx_track_surface: vec![3],
        }
    }

    #[test]
    fn drops_a_repeat_and_keeps_a_change() {
        let mut last = None;
        let mut field = Some(positions(0.5));

        take_if_changed(&mut field, &mut last, false);
        assert!(field.is_some(), "the first publication always goes out");

        let mut field = Some(positions(0.5));
        take_if_changed(&mut field, &mut last, false);
        assert!(field.is_none(), "an identical frame is held back");

        let mut field = Some(positions(0.6));
        take_if_changed(&mut field, &mut last, false);
        assert!(field.is_some(), "a changed frame goes out");
    }

    #[test]
    fn force_republishes_an_unchanged_frame() {
        let mut last = Some(positions(0.5));
        let mut field = Some(positions(0.5));

        take_if_changed(&mut field, &mut last, true);

        assert!(field.is_some());
    }

    // A gated field arrives as None. Recording that as "published" would make
    // the next real frame look like a repeat of nothing and be dropped.
    #[test]
    fn an_absent_field_does_not_disturb_the_record() {
        let mut last = Some(positions(0.5));
        let mut field: Option<CarPositionsFrame> = None;

        take_if_changed(&mut field, &mut last, false);

        assert_eq!(last, Some(positions(0.5)));
    }

    fn bundle_with(pct: f32) -> TelemetryBundle {
        TelemetryBundle {
            car_positions: Some(positions(pct)),
            ..Default::default()
        }
    }

    /// Two groups keep two records. The second group's first tick is a full
    /// bundle even though the first group has already been sent that frame.
    #[test]
    fn every_group_keeps_its_own_record() {
        let mut registry = PublicationRegistry::default();

        let mut first = bundle_with(0.5);
        registry.prune(0b01, &mut first, false);
        assert!(first.car_positions.is_some());

        let mut second = bundle_with(0.5);
        registry.prune(0b10, &mut second, false);
        assert!(
            second.car_positions.is_some(),
            "a new group's first tick is a full bundle"
        );

        let mut repeat = bundle_with(0.5);
        registry.prune(0b01, &mut repeat, false);
        assert!(
            repeat.car_positions.is_none(),
            "a repeat is still held back"
        );
    }

    #[test]
    fn dropping_a_group_forgets_its_record() {
        let mut registry = PublicationRegistry::default();

        let mut first = bundle_with(0.5);
        registry.prune(0b01, &mut first, false);

        registry.retain(&[0b10]);

        let mut back_again = bundle_with(0.5);
        registry.prune(0b01, &mut back_again, false);

        assert!(back_again.car_positions.is_some());
    }

    #[test]
    fn resetting_the_registry_republishes_every_group() {
        let mut registry = PublicationRegistry::default();

        let mut first = bundle_with(0.5);
        registry.prune(0b01, &mut first, false);

        registry.reset();

        let mut after = bundle_with(0.5);
        registry.prune(0b01, &mut after, false);

        assert!(after.car_positions.is_some());
    }
}
