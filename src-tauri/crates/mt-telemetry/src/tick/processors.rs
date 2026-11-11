use super::pit_lane::{locate_pit_target, PitLane};
use super::EVENT_TRACK_SHAPE;

use tracing::warn;

use crate::bundle::{scatter_output, TelemetryBundle};
use crate::delivery::scheduler::DueGroups;
use crate::io_worker::IoWorker;
use crate::loop_state::LoopState;
use mt_computations::{ComputeContext, ComputedOutput, TickRate};
use mt_model::contract::capabilities::Capabilities;
use mt_model::contract::event_sink::EventSink;
use mt_model::contract::telemetry_events::EVENT_LAP_DELTA;
use mt_model::sim::session::SessionSnapshot;
use mt_source::SourceFrame;

/// What the processor stage reads besides the loop state.
pub(super) struct ProcessorRun<'a> {
    pub(super) frame: &'a SourceFrame,
    pub(super) session: &'a SessionSnapshot,
    pub(super) due: DueGroups,
    pub(super) active_mask: u32,
    pub(super) capabilities: Capabilities,
    pub(super) sink: &'a dyn EventSink,
    pub(super) io: &'a IoWorker,
}

/// The processors of the three tiers, with what they hand to disk and to the
/// windows on the way, and the pit-lane target between the first and the
/// rest. Runs only while a session is known.
pub(super) fn run_processors(
    bundle: &mut TelemetryBundle,
    run: ProcessorRun<'_>,
    state: &mut LoopState,
) {
    let ProcessorRun {
        frame,
        session,
        due,
        active_mask,
        capabilities,
        sink,
        io,
    } = run;
    let track_length = state.track_length_m.unwrap_or(0.0);

    let compute_ctx = ComputeContext {
        car_dynamics: &frame.car_dynamics,
        car_inputs: &frame.car_inputs,
        car_idx: &frame.car_idx,
        pacing: &frame.pacing,
        lap_timing: &frame.lap_timing,
        car_status: &frame.car_status,
        pit_service: &frame.pit_service,
        chassis: &frame.chassis,
        environment: &frame.environment,
        session,
        track_length_m: track_length,
        car_length_m: state.config.car_length_m,
        start_positions: &state.start_positions,
        fuel_settings: state.config.fuel,
        lap_delta_active: (active_mask & EVENT_LAP_DELTA) != 0,
        session_num: frame.session.session_num,
        session_time: frame.session.session_time,
        session_time_remain: frame.session.session_time_remain,
        session_state: frame.session.session_state,
        session_flags: frame.session.session_flags,
    };

    // The overlay clock's computed frames (lap delta, gated inside the processor).
    for output in state
        .registry
        .run(TickRate::OverlayClock, capabilities, &compute_ctx)
    {
        match output {
            ComputedOutput::TrackShape(payload) => {
                if let Err(e) = sink.emit(EVENT_TRACK_SHAPE, &payload) {
                    warn!("Failed to emit track shape: {}", e);
                }

                io.save_track_shape(payload);
            }
            ComputedOutput::ReferenceLap(data) => {
                // Fields rather than `note_reference`: the context above still
                // borrows the grid out of `state`.
                let change = state.references.record(data.clone());

                if change.is_some() {
                    state.pending_reference = change;
                }

                io.save_reference_lap(data);
            }
            ComputedOutput::PitLanePct {
                track_id,
                pit_in_pct,
                pit_exit_pct,
            } => {
                state.pit_in_pct = Some(pit_in_pct);
                state.pit_exit_pct = Some(pit_exit_pct);
                io.patch_pit_lane_pct(track_id, pit_in_pct, pit_exit_pct);
            }
            other => scatter_output(bundle, other),
        }
    }

    bundle.pit_target = locate_pit_target(
        frame,
        PitLane {
            pit_in_pct: state.pit_in_pct,
            pit_exit_pct: state.pit_exit_pct,
            pitbox_pct: session.driver_pit_trk_pct,
            track_length,
        },
        &mut state.live_pit_in_pct,
    );

    if due.hz10 {
        for output in state
            .registry
            .run(TickRate::Hz10, capabilities, &compute_ctx)
        {
            scatter_output(bundle, output);
        }
    }

    if due.hz4 {
        for output in state
            .registry
            .run(TickRate::Hz4, capabilities, &compute_ctx)
        {
            match output {
                ComputedOutput::SafetyRating { frame, save } => {
                    if let Some(state_to_save) = save {
                        io.save_safety_rating(*state_to_save);
                    }

                    bundle.safety_rating = Some(frame);
                }
                other => scatter_output(bundle, other),
            }
        }
    }
}
