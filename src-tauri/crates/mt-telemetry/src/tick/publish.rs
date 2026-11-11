use crate::delivery::deliver::{deliver, EventBundleSink};

use crate::bundle::{apply_event_mask, quantize_bundle, TelemetryBundle};
use crate::delivery::dispatch::plan;
use crate::delivery::scheduler::DueGroups;
use crate::loop_state::LoopState;
use crate::state::TelemetryServiceState;
use mt_model::contract::bundle_tap::BundleTap;
use mt_model::contract::event_sink::EventSink;

/// Masks, rounds and delivers a published tick's bundle.
pub(super) fn publish(
    mut bundle: TelemetryBundle,
    active_mask: u32,
    due: DueGroups,
    service: &TelemetryServiceState,
    state: &mut LoopState,
    sink: &dyn EventSink,
    remote: Option<&dyn BundleTap>,
) {
    // Drop what nobody asked for. Deliberately after the processors have run:
    // the mask gates publication, never computation, so a widget switched on
    // mid-race finds the driver table, the gaps and the history intact
    // instead of rebuilding them from the tick it became visible. This is the
    // union; each group narrows it further below.
    apply_event_mask(&mut bundle, active_mask);

    // Round to what a widget can actually draw. Rounding before the comparison
    // in `publications` is what makes repeats compare equal at all — raw floats
    // are never bit-identical two ticks running — and it happens once here
    // rather than once per group, since the groups are subsets of this bundle.
    quantize_bundle(&mut bundle);

    let groups = plan(service.masks.entries());

    deliver(
        &mut state.publications,
        &service.delivery,
        due,
        bundle,
        groups,
        &mut EventBundleSink { sink, remote },
    );
}
