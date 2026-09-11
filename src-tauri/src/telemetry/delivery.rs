//! Counts what each recipient actually received.
//!
//! Tickets 02-04 of the per-window mask make a counting claim — *this window no
//! longer receives this field*. This is the instrument that answers it: per
//! recipient label, how many bundles went out and how many of them carried each
//! demand-gated field. A label's counters begin when it registers and are
//! dropped with it, so a reloaded window never inherits a previous run's totals.

use std::collections::HashMap;
use std::time::Instant;

use super::emitter::TelemetryBundle;

/// The one recipient there is before the mask is split per window: the
/// broadcast every subscribed webview takes.
pub const BROADCAST_LABEL: &str = "broadcast";

/// The demand-gated fields, in bundle order. These are the only ones worth
/// counting: everything else is in every bundle by definition.
pub const GATED_FIELDS: [&str; 7] = [
    "carDynamics",
    "carInputs",
    "carPositions",
    "lapDelta",
    "driverEntries",
    "relative",
    "proximity",
];

/// Which of the gated fields this bundle carries, in `GATED_FIELDS` order.
fn carried(bundle: &TelemetryBundle) -> [bool; GATED_FIELDS.len()] {
    [
        bundle.car_dynamics.is_some(),
        bundle.car_inputs.is_some(),
        bundle.car_positions.is_some(),
        bundle.lap_delta.is_some(),
        bundle.driver_entries.is_some(),
        bundle.relative.is_some(),
        bundle.proximity.is_some(),
    ]
}

/// How many of a label's bundles carried one field.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct FieldDelivery {
    pub field: String,
    pub bundles: u32,
}

/// One recipient's totals over the span its counters have been running.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct DeliverySet {
    pub label: String,
    /// Wall-clock span the counts cover, so a rate can be derived rather than
    /// guessed at from an assumed tick.
    pub elapsed_ms: u32,
    pub bundles: u32,
    pub fields: Vec<FieldDelivery>,
}

struct LabelCounters {
    started: Instant,
    bundles: u32,
    fields: [u32; GATED_FIELDS.len()],
}

impl LabelCounters {
    fn new() -> Self {
        Self {
            started: Instant::now(),
            bundles: 0,
            fields: [0; GATED_FIELDS.len()],
        }
    }
}

/// Delivery counters keyed by recipient label.
#[derive(Default)]
pub struct DeliveryCounters {
    labels: HashMap<String, LabelCounters>,
}

impl DeliveryCounters {
    /// Counters with the broadcast recipient already running.
    pub fn with_broadcast() -> Self {
        let mut counters = Self::default();
        counters.register(BROADCAST_LABEL);

        counters
    }

    /// Starts a label's counters, discarding anything a previous run left.
    pub fn register(&mut self, label: &str) {
        self.labels.insert(label.to_owned(), LabelCounters::new());
    }

    /// Starts a label's counters unless it already has some, so a recipient
    /// that re-registers its appetite — every layout change does — keeps
    /// counting across a measurement run rather than restarting it.
    pub fn ensure(&mut self, label: &str) {
        self.labels
            .entry(label.to_owned())
            .or_insert_with(LabelCounters::new);
    }

    /// Drops a label's counters when its recipient goes away, so a window that
    /// reloads never carries the previous run's totals.
    pub fn drop_label(&mut self, label: &str) {
        self.labels.remove(label);
    }

    /// Records one bundle against a label. Unknown labels are ignored — a
    /// recipient that never registered is not something to start counting
    /// halfway through.
    pub fn record(&mut self, label: &str, bundle: &TelemetryBundle) {
        let Some(counters) = self.labels.get_mut(label) else {
            return;
        };

        counters.bundles += 1;

        for (total, present) in counters.fields.iter_mut().zip(carried(bundle)) {
            *total += u32::from(present);
        }
    }

    /// Restarts every label's counters, so a measurement run has a defined
    /// start. The labels themselves stay — their recipients have not gone away.
    pub fn reset(&mut self) {
        for counters in self.labels.values_mut() {
            *counters = LabelCounters::new();
        }
    }

    pub fn snapshot(&self) -> Vec<DeliverySet> {
        let mut sets: Vec<DeliverySet> = self
            .labels
            .iter()
            .map(|(label, counters)| DeliverySet {
                label: label.clone(),
                elapsed_ms: counters.started.elapsed().as_millis() as u32,
                bundles: counters.bundles,
                fields: GATED_FIELDS
                    .iter()
                    .zip(counters.fields)
                    .map(|(field, bundles)| FieldDelivery {
                        field: (*field).to_owned(),
                        bundles,
                    })
                    .collect(),
            })
            .collect();

        sets.sort_by(|left, right| left.label.cmp(&right.label));

        sets
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::computations::driver_entries::DriverEntriesFrame;
    use crate::model::cars::CarPositionsFrame;
    use crate::telemetry::emitter::{apply_event_mask, TelemetryBundle};
    use crate::telemetry::state::EVENT_CAR_POSITIONS;

    fn positions() -> CarPositionsFrame {
        CarPositionsFrame {
            car_idx_lap_dist_pct: vec![0.5],
            car_idx_track_surface: vec![3],
        }
    }

    fn entries() -> DriverEntriesFrame {
        DriverEntriesFrame {
            entries: vec![],
            player_car_idx: 0,
        }
    }

    fn field_count(set: &DeliverySet, field: &str) -> u32 {
        set.fields
            .iter()
            .find(|delivered| delivered.field == field)
            .unwrap_or_else(|| panic!("no counter for {field}"))
            .bundles
    }

    #[test]
    fn counts_bundles_and_the_fields_they_carry() {
        let mut counters = DeliveryCounters::default();
        counters.register("overlay");

        let bundle = TelemetryBundle {
            car_positions: Some(positions()),
            ..Default::default()
        };
        counters.record("overlay", &bundle);
        counters.record("overlay", &TelemetryBundle::default());

        let snapshot = counters.snapshot();

        assert_eq!(snapshot.len(), 1);
        assert_eq!(snapshot[0].label, "overlay");
        assert_eq!(snapshot[0].bundles, 2, "both bundles are counted");
        assert_eq!(field_count(&snapshot[0], "carPositions"), 1);
        assert_eq!(field_count(&snapshot[0], "lapDelta"), 0);
    }

    #[test]
    fn dropping_a_label_takes_its_counters_with_it() {
        let mut counters = DeliveryCounters::default();
        counters.register("overlay");
        counters.record("overlay", &TelemetryBundle::default());

        counters.drop_label("overlay");

        assert!(counters.snapshot().is_empty());
    }

    // A reloaded window registers again under the same label. It must start
    // from zero, or it reports the previous run's traffic as its own.
    #[test]
    fn registering_again_starts_from_zero() {
        let mut counters = DeliveryCounters::default();
        counters.register("overlay");
        counters.record("overlay", &TelemetryBundle::default());

        counters.register("overlay");

        assert_eq!(counters.snapshot()[0].bundles, 0);
    }

    // The claim tickets 02-04 rest on. A field the mask removed must never be
    // recorded as delivered, or the counters agree with the widget's
    // declaration instead of with what went on the wire.
    #[test]
    fn a_field_the_mask_removed_is_not_counted() {
        let mut counters = DeliveryCounters::default();
        counters.register("overlay");

        let mut bundle = TelemetryBundle {
            car_positions: Some(positions()),
            driver_entries: Some(entries()),
            ..Default::default()
        };
        apply_event_mask(&mut bundle, EVENT_CAR_POSITIONS);
        counters.record("overlay", &bundle);

        let snapshot = counters.snapshot();

        assert_eq!(field_count(&snapshot[0], "carPositions"), 1);
        assert_eq!(
            field_count(&snapshot[0], "driverEntries"),
            0,
            "a gated field is absent from the bundle and from the count"
        );
    }

    // A measurement run needs a defined start, without pretending the
    // recipients went away: the labels stay, their totals and spans restart.
    #[test]
    fn reset_keeps_the_labels_and_zeroes_them() {
        let mut counters = DeliveryCounters::default();
        counters.register("overlay");
        counters.register("main");
        counters.record("overlay", &TelemetryBundle::default());

        counters.reset();

        let snapshot = counters.snapshot();
        assert_eq!(snapshot.len(), 2);
        assert_eq!(snapshot[0].label, "main");
        assert_eq!(snapshot[1].bundles, 0);
    }

    // Every layout change re-registers a window's appetite. If that restarted
    // its counters, a measurement run would report only the traffic since the
    // last drag.
    #[test]
    fn ensuring_an_existing_label_keeps_its_counters() {
        let mut counters = DeliveryCounters::default();
        counters.register("overlay");
        counters.record("overlay", &TelemetryBundle::default());

        counters.ensure("overlay");

        assert_eq!(counters.snapshot()[0].bundles, 1);
    }

    #[test]
    fn ensuring_a_new_label_starts_counting_it() {
        let mut counters = DeliveryCounters::default();

        counters.ensure("overlay");

        assert_eq!(counters.snapshot()[0].label, "overlay");
    }

    #[test]
    fn the_broadcast_recipient_is_counted_from_the_start() {
        let counters = DeliveryCounters::with_broadcast();

        assert_eq!(counters.snapshot()[0].label, BROADCAST_LABEL);
    }
}
