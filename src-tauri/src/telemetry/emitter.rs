/// Event names, `TelemetryBundle` assembly and emission.
///
/// Receives the adapted frame plus the due emit groups from the scheduler,
/// runs the computations via `ProcessorRegistry` and emits a single bundle
/// event per tick.
use std::sync::Mutex;
use std::time::Duration;
#[cfg(feature = "dev")]
use std::time::Instant;

use tauri::{AppHandle, Emitter};
use tracing::{info, warn};

use super::delivery::DeliveryCounters;
use super::dispatch::{mirrors, plan, BundleSink, DeliveryGroup, Recipient};
use super::io_worker::IoWorker;
use super::loop_state::LoopState;
use super::publications::PublicationRegistry;
use super::quantize;
use super::scheduler::DueGroups;
use super::state::TelemetryServiceState;
use crate::capabilities::Capabilities;
use crate::computations::pit_actions::{self, PitActionInput};
use crate::computations::pit_auto::{worst_tire_wear, PitAutoCommand, PitAutoInput};
use crate::computations::{
    coach, driver_entries, fuel, incidents, lap_delta, pace_car, pit_stops, proximity,
    safety_rating, ComputeContext, ComputedOutput, ProcessorCommand, TickRate,
};
use crate::model::cars::{CarIdxFrame, CarPositionsFrame};
use crate::model::environment::EnvironmentFrame;
use crate::model::lap_log::LapLogFrame;
use crate::model::pit_auto::PitAutoFrame;
use crate::model::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame,
    PitServiceFrame, PitTargetFrame,
};
use crate::model::relative::RelativeFrame;
use crate::model::session::{SessionFrame, SessionSnapshot};
use crate::model::telemetry_events::{
    EVENT_CAR_DYNAMICS, EVENT_CAR_INPUTS, EVENT_CAR_POSITIONS, EVENT_COACH, EVENT_DRIVER_ENTRIES,
    EVENT_INCIDENTS, EVENT_LAP_DELTA, EVENT_PROXIMITY, EVENT_RELATIVE, EVENT_SAFETY_RATING,
};
use crate::model::track_shape::TrackRecordingFrame;
use crate::sources::iracing::pit_command::send_pit_order;
use crate::sources::source::SourceFrame;
use crate::utils::lock_or_recover;

// The names themselves live on the contract in `model/events.rs`, where the
// remote hub and the generated TypeScript read them too. Re-exported here
// because this is the module that emits them.
pub use crate::model::events::{
    EVENT_CAPABILITIES, EVENT_DISCONNECTED, EVENT_REFERENCE_LAP_UPDATED, EVENT_SESSION_INFO,
    EVENT_SIM_PERF, EVENT_STATUS, EVENT_TELEMETRY_BUNDLE, EVENT_TELEMETRY_BUNDLE_MIRROR,
    EVENT_TELEMETRY_SLOW, EVENT_TRACK_SHAPE, EVENT_WEATHER_FORECAST,
};

pub struct EmitContext<'a> {
    pub app: &'a AppHandle,
    /// Where the files a processor produces are written, off this thread.
    pub io: &'a IoWorker,
    pub frame: &'a SourceFrame,
    pub due: DueGroups,
    pub service: &'a TelemetryServiceState,
    /// What the loop owns: the session, the processors, the pit lane markers.
    pub state: &'a mut LoopState,
    pub capabilities: Capabilities,
    /// Whether auto mode's orders reach the sim. False on a replayed tape: a
    /// recording with a pit stop in it must not order one in a live sim.
    pub sends_pit_orders: bool,
}

#[derive(Debug, serde::Serialize, Clone, Default)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TelemetryBundle {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub car_dynamics: Option<CarDynamicsFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub car_inputs: Option<CarInputsFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub car_positions: Option<CarPositionsFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lap_delta: Option<lap_delta::LapDeltaFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coach: Option<coach::CoachFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub car_idx: Option<CarIdxFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chassis: Option<ChassisFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lap_timing: Option<LapTimingFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proximity: Option<proximity::ProximityFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub incidents: Option<incidents::IncidentsFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pace_car: Option<pace_car::PaceCarFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relative: Option<RelativeFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub driver_entries: Option<driver_entries::DriverEntriesFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub car_status: Option<CarStatusFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fuel: Option<fuel::FuelComputedFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pit_stops: Option<pit_stops::PitStopsFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub safety_rating: Option<safety_rating::SafetyRatingFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pit_service: Option<PitServiceFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lap_log: Option<LapLogFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session: Option<SessionFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<EnvironmentFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub track_recording: Option<TrackRecordingFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pit_target: Option<PitTargetFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pit_auto: Option<PitAutoFrame>,
}

/// The 4 Hz slice for a window that does not draw widgets.
///
/// The main window is off the bundle (see `SimStore.subscribeBundle`), but it
/// switches layouts by session context, and whether the car is on track is
/// part of that context. The hotkeys no longer need anything from it — they
/// are dispatched here, on the telemetry thread's own frames — so the slice is
/// down to the one frame that answers that.
#[derive(Debug, serde::Serialize, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySlowBundle {
    pub car_status: CarStatusFrame,
}

/// Returns the time spent measuring rather than delivering — the `dev`-only
/// sizing of each bundle — so the tick timing can leave it out.
pub fn emit_domain_frames(ctx: EmitContext<'_>) -> Duration {
    let EmitContext {
        app,
        io,
        frame,
        due,
        service,
        state,
        capabilities,
        sends_pit_orders,
    } = ctx;

    let active_mask = service.masks.effective_mask();

    // The track turning wet or drying swaps the reference; any change queued
    // since the last tick — a session, a new best, a deletion — reaches the
    // coach before it computes on this one, and the windows with it.
    state.track_wetness = frame.environment.track_wetness;
    let change = state.references.observe_wetness(state.track_wetness);
    state.note_reference(change);
    publish_reference(app, service, state);

    // Every field is an `Option` the tiers below fill in, so the empty bundle
    // is the derived default rather than twenty-two `None`s written out.
    let mut bundle = TelemetryBundle::default();

    // 60 Hz — raw frames
    if (active_mask & EVENT_CAR_DYNAMICS) != 0 {
        bundle.car_dynamics = Some(frame.car_dynamics.clone());
    }

    if (active_mask & EVENT_CAR_INPUTS) != 0 {
        bundle.car_inputs = Some(frame.car_inputs.clone());
    }

    // A clone of the Arc, so the processors below can borrow the rest of the state.
    let session_snapshot = state.session.clone();
    let session_info = session_snapshot.as_deref();

    // 60 Hz — lightweight car positions for smooth map/relative rendering
    if (active_mask & EVENT_CAR_POSITIONS) != 0 {
        bundle.car_positions = Some(frame.car_positions.clone());
    }

    // Run processors — only when session is available (mirrors previous behavior)
    if let Some(session) = session_info {
        let track_length = state.track_length_m.unwrap_or(0.0);

        let compute_ctx = ComputeContext {
            car_dynamics: &frame.car_dynamics,
            car_inputs: &frame.car_inputs,
            car_idx: &frame.car_idx,
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
        };

        // 60 Hz computed (lap delta, gated by lap_delta_active inside processor)
        for output in state
            .registry
            .run(TickRate::Hz60, capabilities, &compute_ctx)
        {
            match output {
                ComputedOutput::TrackShape(payload) => {
                    if let Err(e) = app.emit(EVENT_TRACK_SHAPE, &payload) {
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
                other => scatter_output(&mut bundle, other),
            }
        }

        // Where the car is in the pit lane, and how far its box or the exit is.
        let lap_dist_pct = frame.lap_timing.lap_dist_pct;
        let pit_in_pct = state.pit_in_pct;
        let pit_exit_pct = state.pit_exit_pct;
        let pitbox_pct = session.driver_pit_trk_pct;

        // The entry this stint actually used: taken on the first frame the sim
        // reports pit road, dropped on the way out. Anchoring the lane on it
        // keeps the rail from filling the moment the car turns in, where the
        // recorded entry point sits a few meters the other side of the car.
        let live_pit_in_pct = {
            let on_pit_road = frame.car_status.on_pit_road.unwrap_or(false);
            let live = &mut state.live_pit_in_pct;

            if !on_pit_road {
                *live = None;
            } else if live.is_none() {
                *live = lap_dist_pct.filter(|dist| *dist >= 0.0);
            }

            *live
        };

        if let (Some(lap_dist), Some(pit_in), Some(pit_exit)) =
            (lap_dist_pct, pit_in_pct, pit_exit_pct)
        {
            if let Some(pit_target) = crate::computations::pit_target::resolve_pit_target(
                lap_dist,
                pit_in,
                pit_exit,
                live_pit_in_pct,
                pitbox_pct,
                track_length,
            ) {
                bundle.pit_target = Some(PitTargetFrame {
                    dist_m: pit_target.dist_m,
                    target: pit_target.target,
                    lane_progress_pct: pit_target.lane_progress,
                });
            }
        }

        if due.hz10 {
            for output in state
                .registry
                .run(TickRate::Hz10, capabilities, &compute_ctx)
            {
                scatter_output(&mut bundle, output);
            }
        }

        if due.hz4 {
            for output in state
                .registry
                .run(TickRate::Hz4, capabilities, &compute_ctx)
            {
                scatter_output(&mut bundle, output);
            }
        }
    }

    // Every tick, not on a tier: a key pressed is answered within the tick
    // that drains it, against the order the sim reports on that same frame.
    run_pit_actions(frame, session_info, state, sends_pit_orders);

    if due.hz10 {
        bundle.chassis = Some(frame.chassis.clone());
        bundle.car_idx = Some(frame.car_idx.clone());
        bundle.lap_timing = Some(frame.lap_timing.clone());
    }

    if due.hz4 {
        bundle.car_status = Some(frame.car_status.clone());
        bundle.pit_service = Some(frame.pit_service.clone());
        bundle.pit_auto = Some(run_pit_auto(frame, &bundle, state, sends_pit_orders));

        let slow = TelemetrySlowBundle {
            car_status: frame.car_status.clone(),
        };

        if let Err(e) = app.emit(EVENT_TELEMETRY_SLOW, &slow) {
            warn!("Failed to emit slow telemetry bundle: {}", e);
        }

        // The inspector pulls this over a command instead of subscribing, so the
        // settings window never takes the bundle. Nothing is written — not even
        // the clone — while its panel is closed.
        if state.config.inspector_active {
            *lock_or_recover(&service.inspector_frame) = Some(frame.clone());
        }
    }

    if due.hz1 {
        bundle.session = Some(frame.session.clone());
        bundle.environment = Some(frame.environment.clone());

        if let Err(e) = app.emit(EVENT_SIM_PERF, &frame.sim_perf) {
            warn!("Failed to emit sim perf: {}", e);
        }
    }

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
        &mut TauriSink { app },
    )
}

/// Hands a changed active reference to the coach, to commands asking for it,
/// and to every window. A lap recorded this tick is announced on the next.
fn publish_reference(app: &AppHandle, service: &TelemetryServiceState, state: &mut LoopState) {
    let Some(reference) = state.pending_reference.take() else {
        return;
    };

    state
        .registry
        .command(ProcessorCommand::ActiveReference(reference.clone()));
    service.publish_active_reference(reference.clone());

    if let Err(e) = app.emit(EVENT_REFERENCE_LAP_UPDATED, reference.as_deref()) {
        warn!("Failed to emit the active reference lap: {}", e);
    }
}

/// Auto pit mode's tick: decides on this frame, sends what it decided, and
/// returns the state the widget shows. On the 4 Hz tier, after the processors,
/// because the fuel half orders the fuel calculation's `fill_now`.
fn run_pit_auto(
    frame: &SourceFrame,
    bundle: &TelemetryBundle,
    state: &mut LoopState,
    sends_pit_orders: bool,
) -> PitAutoFrame {
    state.planned_fuel_l = bundle
        .fuel
        .as_ref()
        .and_then(|fuel| fuel.refuel_plan.as_ref())
        .map(|plan| plan.fill_now);

    let input = PitAutoInput {
        on_pit_road: frame.car_status.on_pit_road.unwrap_or(false),
        in_pit_stall: frame.pit_service.in_pit_stall,
        service_active: frame.pit_service.service_active,
        armed_flags: frame.pit_service.flags.unwrap_or(0),
        fast_repair_ordered: frame.pit_service.fast_repair,
        tire_wear: worst_tire_wear(&frame.chassis),
        planned_fuel_l: state.planned_fuel_l,
    };
    let config = state.config.pit_auto;

    for order in state.pit_auto.step(&input, &config) {
        if !sends_pit_orders {
            continue;
        }

        let result = send_pit_order(&order);

        info!(?order, ok = result.is_ok(), "auto pit order");
        state.pit_auto.record_send(result.is_ok());
    }

    state.pit_auto.frame(&config)
}

/// The manual pit actions applied this tick: each resolved against this frame
/// and sent, its claim handed to auto mode before the broadcast leaves so the
/// next tick cannot decide that half over the driver's hand. Counted with auto
/// mode's orders, which is how the widget learns one went out.
fn run_pit_actions(
    frame: &SourceFrame,
    session: Option<&SessionSnapshot>,
    state: &mut LoopState,
    sends_pit_orders: bool,
) {
    if state.pending_pit_actions.is_empty() {
        return;
    }

    let compounds: Vec<i32> = session
        .map(|session| {
            session
                .driver_tires
                .iter()
                .map(|tire| tire.tire_index)
                .collect()
        })
        .unwrap_or_default();
    let input = PitActionInput {
        service: &frame.pit_service,
        fuel_in_tank_l: frame.car_status.fuel_level,
        fuel_capacity_l: session.and_then(|session| session.fuel_capacity_ltr),
        planned_fuel_l: state.planned_fuel_l,
        compounds: &compounds,
        fuel_step_l: state.config.pit_auto.fuel_step_liters,
    };

    for action in std::mem::take(&mut state.pending_pit_actions) {
        let Some(order) = pit_actions::resolve(action, &input) else {
            continue;
        };

        if let Some(claim) = order.claim {
            state
                .pit_auto
                .command(PitAutoCommand::Claim(claim), &state.config.pit_auto);
        }

        if !sends_pit_orders {
            info!(?action, "pit action not sent: replaying a tape");

            continue;
        }

        let result = send_pit_order(&order.requests);

        info!(?action, ok = result.is_ok(), "manual pit order");
        state.pit_auto.record_send(result.is_ok());
    }
}

/// The real transport: `emit_to` per window, `app.emit` for the broadcast and
/// for the mirror's internal event.
struct TauriSink<'a> {
    app: &'a AppHandle,
}

impl BundleSink for TauriSink<'_> {
    fn to_window(&mut self, label: &str, bundle: &TelemetryBundle) {
        if let Err(e) = self.app.emit_to(label, EVENT_TELEMETRY_BUNDLE, bundle) {
            warn!("Failed to emit telemetry bundle to {}: {}", label, e);
        }
    }

    fn broadcast(&mut self, bundle: &TelemetryBundle) {
        if let Err(e) = self.app.emit(EVENT_TELEMETRY_BUNDLE, bundle) {
            warn!("Failed to emit telemetry bundle: {}", e);
        }
    }

    fn to_mirror(&mut self, bundle: &TelemetryBundle) {
        if let Err(e) = self.app.emit(EVENT_TELEMETRY_BUNDLE_MIRROR, bundle) {
            warn!(
                "Failed to emit telemetry bundle to the remote mirror: {}",
                e
            );
        }
    }
}

/// Sends one bundle per distinct mask to everyone who asked for exactly that.
///
/// `assembled` is filled from the union and already quantized; each group is
/// that bundle narrowed to its own mask, pruned against its own record and put
/// on the wire once. Returns the time spent sizing bundles for the counters.
fn deliver(
    publications: &mut PublicationRegistry,
    counters: &Mutex<DeliveryCounters>,
    due: DueGroups,
    assembled: TelemetryBundle,
    groups: Vec<DeliveryGroup>,
    sink: &mut impl BundleSink,
) -> Duration {
    // Handed to the last group by value: with one group — one monitor, or two
    // monitors whose widgets want the same fields, which is the common case —
    // nothing is cloned and the tick costs exactly what it did before.
    let mut assembled = Some(assembled);
    let last = groups.len().saturating_sub(1);
    let live: Vec<u32> = groups.iter().map(|group| group.mask).collect();
    let mut delivery = lock_or_recover(counters);
    let mut sizing = Duration::ZERO;

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

        let (size, spent) = measure_size(&bundle);
        sizing += spent;

        for recipient in &group.recipients {
            // Counted here rather than at assembly: what the counters answer is
            // what went on the wire, after the mask and after the repeat
            // suppression have both had their say.
            delivery.record(recipient.label(), &bundle, size);

            match recipient {
                Recipient::Window(label) => sink.to_window(label, &bundle),
                Recipient::Broadcast => sink.broadcast(&bundle),
                // Reached by the mirror re-emit below, which is the only path
                // `remote/mirror.rs` can still see.
                Recipient::Mirror => {}
            }
        }

        if mirrors(&groups, group) {
            sink.to_mirror(&bundle);
        }
    }

    sizing
}

/// The bundle's JSON length and what finding it out cost. A second
/// serialization of what Tauri is about to serialize anyway — the transport
/// keeps its own string to itself — so only a `dev` build pays for it.
#[cfg(feature = "dev")]
fn measure_size(bundle: &TelemetryBundle) -> (Option<usize>, Duration) {
    let started = Instant::now();
    let size = serde_json::to_vec(bundle).ok().map(|bytes| bytes.len());

    (size, started.elapsed())
}

#[cfg(not(feature = "dev"))]
fn measure_size(_bundle: &TelemetryBundle) -> (Option<usize>, Duration) {
    (None, Duration::ZERO)
}

/// Removes from `bundle` every demand-gated field the mask does not ask for.
///
/// The four 60 Hz fields are already left out at assembly, so for them this is
/// a no-op; stating all of them in one place is what makes the function a
/// complete answer to *what may this bundle carry*, which is what the delivery
/// counters are compared against.
pub fn apply_event_mask(bundle: &mut TelemetryBundle, active_mask: u32) {
    if (active_mask & EVENT_CAR_DYNAMICS) == 0 {
        bundle.car_dynamics = None;
    }

    if (active_mask & EVENT_CAR_INPUTS) == 0 {
        bundle.car_inputs = None;
    }

    if (active_mask & EVENT_CAR_POSITIONS) == 0 {
        bundle.car_positions = None;
    }

    if (active_mask & EVENT_LAP_DELTA) == 0 {
        bundle.lap_delta = None;
    }

    if (active_mask & EVENT_DRIVER_ENTRIES) == 0 {
        bundle.driver_entries = None;
    }

    if (active_mask & EVENT_RELATIVE) == 0 {
        bundle.relative = None;
    }

    if (active_mask & EVENT_PROXIMITY) == 0 {
        bundle.proximity = None;
    }

    if (active_mask & EVENT_INCIDENTS) == 0 {
        bundle.incidents = None;
    }

    if (active_mask & EVENT_COACH) == 0 {
        bundle.coach = None;
    }

    if (active_mask & EVENT_SAFETY_RATING) == 0 {
        bundle.safety_rating = None;
    }
}

fn quantize_bundle(bundle: &mut TelemetryBundle) {
    if let Some(frame) = bundle.car_positions.as_mut() {
        quantize::car_positions(frame);
    }

    if let Some(frame) = bundle.car_idx.as_mut() {
        quantize::car_idx(frame);
    }

    if let Some(frame) = bundle.driver_entries.as_mut() {
        quantize::driver_entries(frame);
    }

    if let Some(frame) = bundle.relative.as_mut() {
        quantize::relative(frame);
    }

    if let Some(frame) = bundle.proximity.as_mut() {
        quantize::proximity(frame);
    }

    if let Some(frame) = bundle.pit_target.as_mut() {
        quantize::pit_target(frame);
    }

    if let Some(frame) = bundle.coach.as_mut() {
        quantize::coach(frame);
    }

    if let Some(frame) = bundle.safety_rating.as_mut() {
        quantize::safety_rating(frame);
    }
}

fn scatter_output(bundle: &mut TelemetryBundle, output: ComputedOutput) {
    match output {
        ComputedOutput::Fuel(frame) => bundle.fuel = Some(frame),
        ComputedOutput::LapDelta(frame) => bundle.lap_delta = Some(frame),
        ComputedOutput::Coach(frame) => bundle.coach = Some(frame),
        ComputedOutput::LapLog(frame) => bundle.lap_log = Some(frame),
        ComputedOutput::PitStops(frame) => bundle.pit_stops = Some(frame),
        ComputedOutput::Proximity(frame) => bundle.proximity = Some(frame),
        ComputedOutput::Incidents(frame) => bundle.incidents = Some(frame),
        ComputedOutput::PaceCar(frame) => bundle.pace_car = Some(frame),
        ComputedOutput::Relative(frame) => bundle.relative = Some(frame),
        ComputedOutput::DriverEntries(frame) => bundle.driver_entries = Some(frame),
        ComputedOutput::SafetyRating(frame) => bundle.safety_rating = Some(frame),
        ComputedOutput::TrackRecording(frame) => bundle.track_recording = Some(frame),
        ComputedOutput::TrackShape(_) => {} // handled in Hz60 loop directly
        ComputedOutput::ReferenceLap(_) => {} // handled in Hz60 loop directly
        ComputedOutput::PitLanePct { .. } => {} // handled in Hz60 loop directly
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::computations::driver_entries::DriverEntriesFrame;
    use crate::model::cars::CarPositionsFrame;
    use crate::model::telemetry_events::{EVENT_CAR_POSITIONS, EVENT_DRIVER_ENTRIES};
    use crate::telemetry::delivery::BROADCAST_LABEL;
    use crate::telemetry::masks::{BOOTSTRAP_LABEL, REMOTE_LABEL};

    /// One bundle as it was delivered, and who it went to.
    #[derive(Debug)]
    struct Sent {
        target: String,
        bundle: TelemetryBundle,
    }

    /// Stands in for `TauriSink`. What the real transport can do silently —
    /// above all leaving the mirror unfed — is a missing row here.
    #[derive(Default)]
    struct RecordingSink {
        sent: Vec<Sent>,
    }

    /// The mirror's internal event, named so a test reads as what it asserts.
    const MIRROR_TARGET: &str = "@mirror-event";

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
        fn to_window(&mut self, label: &str, bundle: &TelemetryBundle) {
            self.record(label, bundle);
        }

        fn broadcast(&mut self, bundle: &TelemetryBundle) {
            self.record(BROADCAST_LABEL, bundle);
        }

        fn to_mirror(&mut self, bundle: &TelemetryBundle) {
            self.record(MIRROR_TARGET, bundle);
        }
    }

    /// A tick on which no slow tier is due, so only a non-zero mask emits.
    fn hot_tick() -> DueGroups {
        DueGroups {
            first: false,
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
        // widest-group fallback in `dispatch::mirrors`, which is why this counts
        // the windows rather than every row the sink holds.
        assert_eq!(harness.sink.to("overlay-left").len(), 1);
        assert_eq!(harness.sink.to("overlay-right").len(), 1);
        assert_eq!(
            harness.sink.to(MIRROR_TARGET).len(),
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

    /// The failure mode of this ticket: `emit_to` does not feed `app.listen`,
    /// and nothing logs when the mirror stops receiving — the remote screens
    /// just go stale.
    #[test]
    fn the_mirrors_group_still_reaches_the_tap() {
        let mut harness = Harness::new(&["overlay-left", REMOTE_LABEL]);

        harness.tick(
            hot_tick(),
            assembled(0.5),
            &[
                ("overlay-left", EVENT_CAR_POSITIONS | EVENT_DRIVER_ENTRIES),
                (REMOTE_LABEL, EVENT_CAR_POSITIONS),
            ],
        );

        let mirrored = harness.sink.to(MIRROR_TARGET);

        assert_eq!(mirrored.len(), 1, "the mirror is fed exactly once");
        assert!(mirrored[0].car_positions.is_some());
        assert!(
            mirrored[0].driver_entries.is_none(),
            "the remote screens pay for their own appetite, not the union"
        );
    }

    /// Before any window has registered, the mirror has no appetite of its own
    /// and the bootstrap broadcast is what it lives on.
    #[test]
    fn the_bootstrap_broadcast_feeds_the_tap_too() {
        let mut harness = Harness::new(&[BROADCAST_LABEL]);

        harness.tick(hot_tick(), assembled(0.5), &[(BOOTSTRAP_LABEL, u32::MAX)]);

        assert_eq!(harness.sink.to(BROADCAST_LABEL).len(), 1);
        assert_eq!(harness.sink.to(MIRROR_TARGET).len(), 1);
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
}
