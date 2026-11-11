use crate::tick::EVENT_TELEMETRY_BUNDLE;
use std::sync::Mutex;

use tracing::warn;

use crate::bundle::{apply_event_mask, TelemetryBundle};
use crate::delivery::counters::DeliveryCounters;
use crate::delivery::dispatch::{feeds_remote, BundleSink, DeliveryGroup, Recipient};
use crate::delivery::encoded::EncodedBundle;
use crate::delivery::publications::PublicationRegistry;
use crate::delivery::scheduler::DueGroups;
use mt_model::contract::bundle_tap::BundleTap;
use mt_model::contract::event_sink::EventSink;
use mt_model::utils::lock_or_recover;

/// The real transport: `emit_to` per window, `emit` for the broadcast, and the
/// remote hub for the remote screens — all handed the one encoded string.
pub(crate) struct EventBundleSink<'a> {
    pub(crate) sink: &'a dyn EventSink,
    pub(crate) remote: Option<&'a dyn BundleTap>,
}

impl BundleSink for EventBundleSink<'_> {
    fn to_window(&mut self, label: &str, bundle: &EncodedBundle<'_>) {
        if let Err(e) = self
            .sink
            .emit_json_to(label, EVENT_TELEMETRY_BUNDLE, bundle.json.clone())
        {
            warn!("Failed to emit telemetry bundle to {}: {}", label, e);
        }
    }

    fn broadcast(&mut self, bundle: &EncodedBundle<'_>) {
        if let Err(e) = self
            .sink
            .emit_json(EVENT_TELEMETRY_BUNDLE, bundle.json.clone())
        {
            warn!("Failed to emit telemetry bundle: {}", e);
        }
    }

    fn to_remote(&mut self, bundle: &EncodedBundle<'_>) {
        if let Some(remote) = self.remote {
            remote.publish_bundle(&bundle.json, bundle.carries_slow_fields);
        }
    }
}

/// Sends one bundle per distinct mask to everyone who asked for exactly that.
///
/// `assembled` is filled from the union and already quantized; each group is
/// that bundle narrowed to its own mask, pruned against its own record and put
/// encoded once for every recipient of the group.
pub(crate) fn deliver(
    publications: &mut PublicationRegistry,
    counters: &Mutex<DeliveryCounters>,
    due: DueGroups,
    assembled: TelemetryBundle,
    groups: Vec<DeliveryGroup>,
    sink: &mut impl BundleSink,
) {
    // Handed to the last group by value: with one group — one monitor, or two
    // monitors whose widgets want the same fields, which is the common case —
    // nothing is cloned and the tick costs exactly what it did before.
    let mut assembled = Some(assembled);
    let last = groups.len().saturating_sub(1);
    let live: Vec<u32> = groups.iter().map(|group| group.mask).collect();
    let mut delivery = lock_or_recover(counters);

    publications.retain(&live);

    for (index, group) in groups.iter().enumerate() {
        // A clone is the price of a window that wants something different from
        // its neighbour; the last group is handed the assembled bundle itself.
        let taken = if index == last {
            assembled.take()
        } else {
            assembled.as_ref().cloned()
        };

        let Some(mut bundle) = taken else {
            break;
        };

        apply_event_mask(&mut bundle, group.mask);

        // The 1 Hz tier carries a full bundle. See `publications` — it is what
        // a window that just reloaded, or a phone that just opened a remote
        // screen, needs in order to paint anything at all.
        publications.prune(group.mask, &mut bundle, due.first || due.hz1);

        // Mask 0 is "slow tiers only", not silence: a window with no hot widget
        // still gets session, fuel and status. Silence is removal from the
        // registry.
        let should_emit = group.mask != 0 || due.first || due.hz10 || due.hz4 || due.hz1;

        if !should_emit {
            continue;
        }

        let encoded = match EncodedBundle::of(&bundle) {
            Ok(encoded) => encoded,
            Err(error) => {
                warn!("Failed to encode telemetry bundle: {error}");

                continue;
            }
        };
        let size = Some(encoded.json.len());

        for recipient in &group.recipients {
            // Counted here rather than at assembly: what the counters answer is
            // what went on the wire, after the mask and after the repeat
            // suppression have both had their say.
            delivery.record(recipient.label(), &bundle, size);

            match recipient {
                Recipient::Window(label) => sink.to_window(label, &encoded),
                Recipient::Broadcast => sink.broadcast(&encoded),
                // Fed below, whichever group stands in for the remote screens.
                Recipient::Remote => {}
            }
        }

        if feeds_remote(&groups, group) {
            sink.to_remote(&encoded);
        }
    }
}

#[cfg(test)]
mod tests;
