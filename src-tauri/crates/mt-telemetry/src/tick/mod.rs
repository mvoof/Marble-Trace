//! Event names, `TelemetryBundle` assembly and emission.
//!
//! Receives the adapted frame plus the due emit groups from the scheduler,
//! runs the computations via `ProcessorRegistry` and emits a single bundle
//! event per tick.

pub(crate) mod actions;
mod pit_lane;
mod processors;
mod publish;
mod raw_frames;
mod references;
mod session_notes;
mod slow_tiers;

use crate::crew::run_crew;
use crate::delivery::scheduler::DueGroups;
use crate::io_worker::IoWorker;
use crate::loop_state::LoopState;
use crate::state::TelemetryServiceState;
use mt_model::app::crew::CrewSink;
use mt_model::contract::bundle_tap::BundleTap;
use mt_model::contract::capabilities::Capabilities;
use mt_model::contract::event_sink::EventSink;
use mt_source::{PitCommander, SourceFrame};

use crate::bundle::TelemetryBundle;
use actions::run_pit_actions;
use processors::{run_processors, ProcessorRun};
use publish::publish;
use raw_frames::collect_raw_frames;
use references::announce_reference;
use session_notes::note_last_race;
use slow_tiers::{collect_slow_tiers, SlowTierRun};

// The names themselves live on the contract in `mt-model/src/contract/events.rs`, where the
// remote hub and the generated TypeScript read them too. Re-exported here
// because this is the module that emits them.
pub use mt_model::contract::events::{
    EVENT_CAPABILITIES, EVENT_DISCONNECTED, EVENT_REFERENCE_LAP_UPDATED, EVENT_SESSION_INFO,
    EVENT_SIM_PERF, EVENT_STATUS, EVENT_TELEMETRY_BUNDLE, EVENT_TELEMETRY_SLOW, EVENT_TRACK_SHAPE,
    EVENT_WEATHER_FORECAST,
};

pub struct EmitContext<'a> {
    pub sink: &'a dyn EventSink,
    /// The remote screens' feed, when the app runs a remote hub.
    pub remote: Option<&'a dyn BundleTap>,
    /// Where the files a processor produces are written, off this thread.
    pub io: &'a IoWorker,
    pub frame: &'a SourceFrame,
    pub due: DueGroups,
    pub service: &'a TelemetryServiceState,
    /// What the loop owns: the session, the processors, the pit lane markers.
    pub state: &'a mut LoopState,
    pub capabilities: Capabilities,
    /// How orders reach the sim; `None` where they cannot, a replayed tape
    /// among them (`TelemetrySource::pit_commander`).
    pub pit: Option<&'a dyn PitCommander>,
    /// The voice crew, when the app runs one.
    pub crew: Option<&'a dyn CrewSink>,
}

/// One tick, as a sequence of stages. The order is the contract: the
/// reference is settled before the coach computes on it, the processors run
/// before the actions read their frames, every stateful stage runs on every
/// tick, and only then is the bundle masked, rounded and sent — on the ticks
/// that publish.
pub fn emit_domain_frames(ctx: EmitContext<'_>) {
    let EmitContext {
        sink,
        remote,
        io,
        frame,
        due,
        service,
        state,
        capabilities,
        pit,
        crew,
    } = ctx;

    let active_mask = service.masks.effective_mask();

    announce_reference(frame, sink, service, state);

    // Every field is an `Option` the stages below fill in, so the empty bundle
    // is the derived default rather than twenty-two `None`s written out.
    let mut bundle = TelemetryBundle::default();

    collect_raw_frames(&mut bundle, frame, due, active_mask, state);

    // A clone of the Arc, so the processors below can borrow the rest of the state.
    let session_snapshot = state.session.clone();
    let session_info = session_snapshot.as_deref();

    if let Some(session) = session_info {
        run_processors(
            &mut bundle,
            ProcessorRun {
                frame,
                session,
                due,
                active_mask,
                capabilities,
                sink,
                io,
            },
            state,
        );
    }

    // Every tick, not on a tier: a key pressed is answered within the tick
    // that drains it, against the order the sim reports on that same frame.
    run_pit_actions(frame, session_info, state, pit);
    run_crew(frame, &bundle, session_info, state, pit, crew);
    note_last_race(frame, &bundle, session_info, state, io);

    collect_slow_tiers(
        &mut bundle,
        SlowTierRun {
            frame,
            session_info,
            due,
            sink,
            service,
            io,
            pit,
        },
        state,
    );

    // Everything above that keeps state has run; what is left only builds and
    // sends the bundle. Between published ticks there is nothing to send — a
    // frame computed here is a snapshot the next published tick replaces.
    if !due.publish {
        return;
    }

    publish(bundle, active_mask, due, service, state, sink, remote);
}
