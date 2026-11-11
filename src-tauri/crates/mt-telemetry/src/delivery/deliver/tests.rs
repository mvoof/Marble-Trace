use super::*;
use crate::delivery::counters::BROADCAST_LABEL;
use crate::delivery::dispatch::plan;
use crate::delivery::masks::{BOOTSTRAP_LABEL, REMOTE_LABEL};
use mt_computations::field::driver_entries::DriverEntriesFrame;
use mt_model::contract::telemetry_events::{EVENT_CAR_POSITIONS, EVENT_DRIVER_ENTRIES};
use mt_model::sim::cars::CarPositionsFrame;

/// One bundle as it was delivered, and who it went to.
#[derive(Debug)]
struct Sent {
    target: String,
    bundle: TelemetryBundle,
}

/// Stands in for `EventBundleSink`. What the real transport can do silently —
/// above all leaving the remote screens unfed — is a missing row here.
#[derive(Default)]
struct RecordingSink {
    sent: Vec<Sent>,
}

/// The remote hub, named so a test reads as what it asserts.
const REMOTE_TARGET: &str = "@remote-hub";

impl RecordingSink {
    fn to(&self, target: &str) -> Vec<&TelemetryBundle> {
        self.sent
            .iter()
            .filter(|sent| sent.target == target)
            .map(|sent| &sent.bundle)
            .collect()
    }

    fn record(&mut self, target: &str, bundle: &TelemetryBundle) {
        self.sent.push(Sent {
            target: target.to_owned(),
            bundle: bundle.clone(),
        });
    }
}

impl BundleSink for RecordingSink {
    fn to_window(&mut self, label: &str, bundle: &EncodedBundle<'_>) {
        self.record(label, bundle.bundle);
    }

    fn broadcast(&mut self, bundle: &EncodedBundle<'_>) {
        self.record(BROADCAST_LABEL, bundle.bundle);
    }

    fn to_remote(&mut self, bundle: &EncodedBundle<'_>) {
        self.record(REMOTE_TARGET, bundle.bundle);
    }
}

/// A tick on which no slow tier is due, so only a non-zero mask emits.
fn hot_tick() -> DueGroups {
    DueGroups {
        first: false,
        publish: true,
        hz10: false,
        hz4: false,
        hz1: false,
    }
}

fn positions(pct: f32) -> CarPositionsFrame {
    CarPositionsFrame {
        car_idx_lap_dist_pct: vec![pct],
        car_idx_track_surface: vec![3],
    }
}

fn entries() -> DriverEntriesFrame {
    DriverEntriesFrame {
        entries: vec![],
        player_car_idx: 0,
        pit_lane_loss_s: None,
        pit_exit_loss_s: None,
    }
}

/// A bundle filled from the union, as the emitter hands it to `deliver`.
fn assembled(pct: f32) -> TelemetryBundle {
    TelemetryBundle {
        car_positions: Some(positions(pct)),
        driver_entries: Some(entries()),
        ..Default::default()
    }
}

struct Harness {
    publications: PublicationRegistry,
    counters: Mutex<DeliveryCounters>,
    sink: RecordingSink,
}

impl Harness {
    fn new(labels: &[&str]) -> Self {
        let mut counters = DeliveryCounters::default();

        for label in labels {
            counters.register(label);
        }

        Self {
            publications: PublicationRegistry::default(),
            counters: Mutex::new(counters),
            sink: RecordingSink::default(),
        }
    }

    fn tick(&mut self, due: DueGroups, bundle: TelemetryBundle, registry: &[(&str, u32)]) {
        let entries = registry
            .iter()
            .map(|(label, mask)| ((*label).to_owned(), *mask))
            .collect();

        deliver(
            &mut self.publications,
            &self.counters,
            due,
            bundle,
            plan(entries),
            &mut self.sink,
        );
    }
}

/// The claim the whole feature rests on: the window that asked for the
/// per-car frame gets it, and the one that did not never sees it.
#[test]
fn each_group_gets_its_own_bundle_and_not_the_others_fields() {
    let mut harness = Harness::new(&["overlay-left", "overlay-right"]);

    harness.tick(
        hot_tick(),
        assembled(0.5),
        &[
            ("overlay-left", EVENT_CAR_POSITIONS | EVENT_DRIVER_ENTRIES),
            ("overlay-right", EVENT_CAR_POSITIONS),
        ],
    );

    let left = harness.sink.to("overlay-left");
    let right = harness.sink.to("overlay-right");

    assert_eq!(left.len(), 1);
    assert_eq!(right.len(), 1);
    assert!(left[0].driver_entries.is_some());
    assert!(right[0].car_positions.is_some());
    assert!(
        right[0].driver_entries.is_none(),
        "a field only the other monitor asked for never reaches this window"
    );
}

/// The common case. If two windows wanting the same thing produced two
/// serializations, this work would cost most users more than it saves.
#[test]
fn identical_masks_are_serialized_once_and_sent_to_both() {
    let mut harness = Harness::new(&["overlay-left", "overlay-right"]);

    harness.tick(
        hot_tick(),
        assembled(0.5),
        &[
            ("overlay-left", EVENT_CAR_POSITIONS),
            ("overlay-right", EVENT_CAR_POSITIONS),
        ],
    );

    // One delivery each, out of one bundle. The tap is fed as well, by the
    // widest-group fallback in `dispatch::feeds_remote`, which is why this counts
    // the windows rather than every row the sink holds.
    assert_eq!(harness.sink.to("overlay-left").len(), 1);
    assert_eq!(harness.sink.to("overlay-right").len(), 1);
    assert_eq!(
        harness.sink.to(REMOTE_TARGET).len(),
        1,
        "the tap is never left unfed, even with no remote appetite registered"
    );
}

/// A group that appears later must not be muted by what an older group was
/// already sent — its window starts with empty stores.
#[test]
fn a_new_groups_first_tick_is_a_full_bundle() {
    let mut harness = Harness::new(&["overlay-left", "overlay-right"]);

    harness.tick(
        hot_tick(),
        assembled(0.5),
        &[("overlay-left", EVENT_CAR_POSITIONS)],
    );

    // The same frame again: the established group is held back, the new one
    // is not.
    harness.tick(
        hot_tick(),
        assembled(0.5),
        &[
            ("overlay-left", EVENT_CAR_POSITIONS),
            ("overlay-right", EVENT_CAR_POSITIONS | EVENT_DRIVER_ENTRIES),
        ],
    );

    let left = harness.sink.to("overlay-left");
    let right = harness.sink.to("overlay-right");

    assert!(left[1].car_positions.is_none(), "a repeat is held back");
    assert!(
        right[0].car_positions.is_some(),
        "the new group has been sent nothing yet and gets it all"
    );
}

/// A remote screen fed nothing logs nothing — it just goes stale.
#[test]
fn the_remote_group_reaches_the_tap() {
    let mut harness = Harness::new(&["overlay-left", REMOTE_LABEL]);

    harness.tick(
        hot_tick(),
        assembled(0.5),
        &[
            ("overlay-left", EVENT_CAR_POSITIONS | EVENT_DRIVER_ENTRIES),
            (REMOTE_LABEL, EVENT_CAR_POSITIONS),
        ],
    );

    let fed = harness.sink.to(REMOTE_TARGET);

    assert_eq!(fed.len(), 1, "the remote screens are fed exactly once");
    assert!(fed[0].car_positions.is_some());
    assert!(
        fed[0].driver_entries.is_none(),
        "the remote screens pay for their own appetite, not the union"
    );
}

/// Before any window has registered, the remote screens have no appetite of their own
/// and the bootstrap broadcast is what it lives on.
#[test]
fn the_bootstrap_broadcast_feeds_the_tap_too() {
    let mut harness = Harness::new(&[BROADCAST_LABEL]);

    harness.tick(hot_tick(), assembled(0.5), &[(BOOTSTRAP_LABEL, u32::MAX)]);

    assert_eq!(harness.sink.to(BROADCAST_LABEL).len(), 1);
    assert_eq!(harness.sink.to(REMOTE_TARGET).len(), 1);
}

/// Mask 0 is "slow tiers only", not silence.
#[test]
fn a_window_with_no_hot_widget_still_gets_the_slow_tiers() {
    let mut harness = Harness::new(&["overlay-right"]);

    harness.tick(hot_tick(), assembled(0.5), &[("overlay-right", 0)]);

    assert!(
        harness.sink.to("overlay-right").is_empty(),
        "nothing is due and nothing is wanted"
    );

    let due = DueGroups {
        hz4: true,
        ..hot_tick()
    };
    harness.tick(due, assembled(0.5), &[("overlay-right", 0)]);

    assert_eq!(harness.sink.to("overlay-right").len(), 1);
}

/// What the counters report is what the sink was handed — per window, after
/// the mask and the repeat suppression have both had their say.
#[test]
fn the_counters_follow_the_groups() {
    let mut harness = Harness::new(&["overlay-left", "overlay-right"]);

    harness.tick(
        hot_tick(),
        assembled(0.5),
        &[
            ("overlay-left", EVENT_CAR_POSITIONS | EVENT_DRIVER_ENTRIES),
            ("overlay-right", EVENT_CAR_POSITIONS),
        ],
    );

    let snapshot = lock_or_recover(&harness.counters).snapshot();
    let carried = |label: &str, field: &str| {
        snapshot
            .iter()
            .find(|set| set.label == label)
            .and_then(|set| set.fields.iter().find(|delivered| delivered.field == field))
            .map(|delivered| delivered.bundles)
            .unwrap_or_default()
    };

    assert_eq!(carried("overlay-left", "driverEntries"), 1);
    assert_eq!(carried("overlay-right", "driverEntries"), 0);
    assert_eq!(carried("overlay-right", "carPositions"), 1);
}

/// A group that goes away must not keep its record for the rest of the
/// session — and must not find it on coming back.
#[test]
fn a_group_that_disappears_forgets_what_it_was_sent() {
    let mut harness = Harness::new(&["overlay-left", "overlay-right"]);

    harness.tick(
        hot_tick(),
        assembled(0.5),
        &[("overlay-right", EVENT_CAR_POSITIONS)],
    );
    harness.tick(
        hot_tick(),
        assembled(0.5),
        &[("overlay-left", EVENT_DRIVER_ENTRIES)],
    );
    harness.tick(
        hot_tick(),
        assembled(0.5),
        &[("overlay-right", EVENT_CAR_POSITIONS)],
    );

    let right = harness.sink.to("overlay-right");

    assert_eq!(right.len(), 2);
    assert!(
        right[1].car_positions.is_some(),
        "the group was gone, so its record went with it"
    );
}
