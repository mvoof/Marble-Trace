use crate::bundle::TelemetryBundle;
use crate::delivery::quantize;
use crate::io_worker::IoWorker;
use crate::loop_state::LoopState;
use mt_computations::field::driver_entries::DriverEntry;
use mt_computations::rating::last_race::FinishSource;
use mt_model::sim::session::SessionSnapshot;
use mt_source::SourceFrame;

/// Saves what the event has measured when it changed. An event the sim gives no
/// id has nothing to be told apart by, so it is not kept.
pub(super) fn note_session_memory(
    session: Option<&SessionSnapshot>,
    state: &mut LoopState,
    io: &IoWorker,
) {
    let Some(sub_session_id) = session.and_then(|session| session.sub_session_id) else {
        return;
    };

    let mut memory = state.registry.session_memory(sub_session_id);
    memory.pit_auto_suspended = state.pit_auto.is_suspended();

    if memory.is_blank() || state.saved_memory.as_ref() == Some(&memory) {
        return;
    }

    io.save_session_memory(memory.clone());
    state.saved_memory = Some(memory);
}

/// Keeps the record of a race under the flag on disk, on the tier the Safety
/// Rating arrives on. The record changes as the sim refines the result; a tick
/// that changes nothing writes nothing.
pub(super) fn note_last_race(
    frame: &SourceFrame,
    bundle: &TelemetryBundle,
    session: Option<&SessionSnapshot>,
    state: &mut LoopState,
    io: &IoWorker,
) {
    retain_player_entry(&mut state.player_entry, bundle);

    let (Some(session), Some(safety_rating)) = (session, bundle.safety_rating.as_ref()) else {
        return;
    };
    // Rounded as the widget shows it: this runs ahead of the delivery rounding.
    let mut safety_rating = safety_rating.clone();

    quantize::safety_rating(&mut safety_rating);

    let source = FinishSource {
        session,
        session_num: frame.session.session_num,
        session_state: frame.session.session_state,
        safety_rating: &safety_rating,
        player: state.player_entry.as_ref(),
    };
    let Some(race) = source.last_race() else {
        return;
    };

    if state.last_race.as_ref() != Some(&race) {
        io.save_last_race(race.clone());
        state.last_race = Some(race);
    }
}

/// Between driver tables the last row stands.
pub(super) fn retain_player_entry(retained: &mut Option<DriverEntry>, bundle: &TelemetryBundle) {
    let player = bundle
        .driver_entries
        .iter()
        .flat_map(|frame| &frame.entries)
        .find(|entry| entry.is_player);

    if let Some(player) = player {
        *retained = Some(player.clone());
    }
}

#[cfg(test)]
mod tests;
