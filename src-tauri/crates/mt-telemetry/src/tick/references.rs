use super::EVENT_REFERENCE_LAP_UPDATED;

use tracing::warn;

use crate::loop_state::LoopState;
use crate::state::TelemetryServiceState;
use mt_computations::ProcessorCommand;
use mt_model::contract::event_sink::EventSink;
use mt_source::SourceFrame;

/// The track turning wet or drying swaps the reference; any change queued
/// since the last tick — a session, a new best, a deletion — reaches the coach
/// before it computes on this one, and the windows with it.
pub(super) fn announce_reference(
    frame: &SourceFrame,
    sink: &dyn EventSink,
    service: &TelemetryServiceState,
    state: &mut LoopState,
) {
    state.track_wetness = frame.environment.track_wetness;
    let change = state.references.observe_wetness(state.track_wetness);
    state.note_reference(change);
    publish_reference(sink, service, state);
}

/// Hands a changed active reference to the coach, to commands asking for it,
/// and to every window. A lap recorded this tick is announced on the next.
pub(super) fn publish_reference(
    sink: &dyn EventSink,
    service: &TelemetryServiceState,
    state: &mut LoopState,
) {
    let Some(reference) = state.pending_reference.take() else {
        return;
    };

    state
        .registry
        .command(ProcessorCommand::ActiveReference(reference.clone()));
    service.publish_active_reference(reference.clone());

    if let Err(e) = sink.emit(EVENT_REFERENCE_LAP_UPDATED, &reference.as_deref()) {
        warn!("Failed to emit the active reference lap: {}", e);
    }
}
