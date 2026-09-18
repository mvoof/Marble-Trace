/// Event names, `TelemetryBundle` assembly and emission.
///
/// Receives the adapted frame plus the due emit groups from the scheduler,
/// runs the computations via `ProcessorRegistry` and emits a single bundle
/// event per tick.
use std::sync::atomic::Ordering;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};
use tracing::warn;

use super::delivery::DeliveryCounters;
use super::dispatch::{mirrors, plan, BundleSink, DeliveryGroup, Recipient};
use super::publications::PublicationRegistry;
use super::quantize;
use super::scheduler::DueGroups;
use super::state::{
    TelemetryServiceState, EVENT_CAR_DYNAMICS, EVENT_CAR_INPUTS, EVENT_CAR_POSITIONS,
    EVENT_DRIVER_ENTRIES, EVENT_INCIDENTS, EVENT_LAP_DELTA, EVENT_PROXIMITY, EVENT_RELATIVE,
};
use crate::capabilities::Capabilities;
use crate::computations::{
    driver_entries, fuel, incidents, lap_delta, pit_stops, proximity, ComputeContext,
    ComputedOutput, ProcessorRegistry, TickRate,
};
use crate::model::cars::{CarIdxFrame, CarPositionsFrame};
use crate::model::environment::EnvironmentFrame;
use crate::model::lap_log::LapLogFrame;
use crate::model::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame,
    PitServiceFrame, PitTargetFrame,
};
use crate::model::reference_lap::{ReferenceLapData, TrackCondition};
use crate::model::relative::RelativeFrame;
use crate::model::session::SessionFrame;
use crate::model::track_shape::{TrackRecordingFrame, TrackShapePayload};
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
    pub frame: &'a SourceFrame,
    pub due: DueGroups,
    pub service: &'a TelemetryServiceState,
    pub registry: &'a Mutex<ProcessorRegistry>,
    pub fuel_settings: fuel::FuelSettings,
    pub capabilities: Capabilities,
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
}

/// The 4 Hz slice a window that does not draw widgets still needs.
///
/// The main window is off the bundle (see `SimStore.subscribeBundle`), but it
/// still owns the hotkey runner and the automatic pit order, and both of those
/// decide off these four frames: the fuel calculation, what the sim has on the
/// order, where the car is on pit road, and the lap it is on. Sending them on
/// their own event keeps main at 4 Hz instead of 60 while leaving it able to
/// answer a key press.
#[derive(Debug, serde::Serialize, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySlowBundle {
    pub car_status: CarStatusFrame,
    pub lap_timing: LapTimingFrame,
    pub pit_service: PitServiceFrame,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fuel: Option<fuel::FuelComputedFrame>,
    /// Distinct car classes in the field. A count rather than the entries: the
    /// standings class hotkeys only need to know where the cycle wraps, and the
    /// per-car frame is exactly what main is off the bundle to avoid.
    pub car_class_count: u32,
}

pub fn emit_domain_frames(ctx: EmitContext<'_>) {
    let app = ctx.app;
    let frame = ctx.frame;
    let due = ctx.due;

    let active_mask = ctx.service.masks.effective_mask();
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

    // Clone session_info Arc — cheap enough to do at 60Hz for accurate computations
    let session_snapshot = lock_or_recover(&ctx.service.last_session_info).clone();
    let session_info = session_snapshot.as_deref();

    // 60 Hz — lightweight car positions for smooth map/relative rendering
    if (active_mask & EVENT_CAR_POSITIONS) != 0 {
        bundle.car_positions = Some(frame.car_positions.clone());
    }

    // Run processors — only when session is available (mirrors previous behavior)
    if let Some(session) = session_info {
        let track_length = lock_or_recover(&ctx.service.track_length_m).unwrap_or(0.0);
        let car_length = *lock_or_recover(&ctx.service.car_length_m);
        let start_pos_snapshot = lock_or_recover(&ctx.service.start_positions).clone();

        let compute_ctx = ComputeContext {
            car_dynamics: &frame.car_dynamics,
            car_inputs: &frame.car_inputs,
            car_idx: &frame.car_idx,
            lap_timing: &frame.lap_timing,
            car_status: &frame.car_status,
            chassis: &frame.chassis,
            environment: &frame.environment,
            session,
            track_length_m: track_length,
            car_length_m: car_length,
            start_positions: &start_pos_snapshot,
            fuel_settings: ctx.fuel_settings,
            lap_delta_active: (active_mask & EVENT_LAP_DELTA) != 0,
            session_num: frame.session.session_num,
            session_time_remain: frame.session.session_time_remain,
            session_state: frame.session.session_state,
        };

        let mut registry = lock_or_recover(ctx.registry);

        // 60 Hz computed (lap delta, gated by lap_delta_active inside processor)
        for output in registry.run(TickRate::Hz60, ctx.capabilities, &compute_ctx) {
            match output {
                ComputedOutput::TrackShape(ref payload) => {
                    if let Err(e) = app.emit(EVENT_TRACK_SHAPE, payload) {
                        warn!("Failed to emit track shape: {}", e);
                    }

                    save_track_shape(app, payload);
                }
                ComputedOutput::ReferenceLap(ref data) => {
                    if let Err(e) = app.emit(EVENT_REFERENCE_LAP_UPDATED, data) {
                        warn!("Failed to emit reference lap update: {}", e);
                    }

                    save_reference_lap(app, data);
                }
                ComputedOutput::PitLanePct {
                    track_id,
                    pit_in_pct,
                    pit_exit_pct,
                } => {
                    if let Ok(mut lock) = ctx.service.pit_in_pct.lock() {
                        *lock = Some(pit_in_pct);
                    }
                    if let Ok(mut lock) = ctx.service.pit_exit_pct.lock() {
                        *lock = Some(pit_exit_pct);
                    }
                    patch_pit_lane_pct(app, track_id, pit_in_pct, pit_exit_pct);
                }
                other => scatter_output(&mut bundle, other),
            }
        }

        // Where the car is in the pit lane, and how far its box or the exit is.
        let lap_dist_pct = frame.lap_timing.lap_dist_pct;
        let pit_in_pct = ctx
            .service
            .pit_in_pct
            .lock()
            .map(|lock| *lock)
            .unwrap_or(None);
        let pit_exit_pct = ctx
            .service
            .pit_exit_pct
            .lock()
            .map(|lock| *lock)
            .unwrap_or(None);
        let pitbox_pct = session.driver_pit_trk_pct;

        // The entry this stint actually used: taken on the first frame the sim
        // reports pit road, dropped on the way out. Anchoring the lane on it
        // keeps the rail from filling the moment the car turns in, where the
        // recorded entry point sits a few meters the other side of the car.
        let live_pit_in_pct = {
            let on_pit_road = frame.car_status.on_pit_road.unwrap_or(false);
            let mut live = lock_or_recover(&ctx.service.live_pit_in_pct);

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
            for output in registry.run(TickRate::Hz10, ctx.capabilities, &compute_ctx) {
                scatter_output(&mut bundle, output);
            }

            // Recorded before the demand gate below, so the count survives even
            // when no widget asks for the entries themselves.
            if let Some(entries) = &bundle.driver_entries {
                ctx.service
                    .car_class_count
                    .store(count_car_classes(entries), Ordering::Relaxed);
            }
        }

        if due.hz4 {
            for output in registry.run(TickRate::Hz4, ctx.capabilities, &compute_ctx) {
                scatter_output(&mut bundle, output);
            }
        }
    }

    if due.hz10 {
        bundle.chassis = Some(frame.chassis.clone());
        bundle.car_idx = Some(frame.car_idx.clone());
        bundle.lap_timing = Some(frame.lap_timing.clone());
    }

    if due.hz4 {
        bundle.car_status = Some(frame.car_status.clone());
        bundle.pit_service = Some(frame.pit_service.clone());

        // Built from the bundle's own frames, so a window off the bundle reads
        // exactly what the overlay reads rather than a second calculation of
        // it. Sent before the gating below, which only concerns the bundle.
        let slow = TelemetrySlowBundle {
            car_status: frame.car_status.clone(),
            lap_timing: frame.lap_timing.clone(),
            pit_service: frame.pit_service.clone(),
            fuel: bundle.fuel.clone(),
            car_class_count: ctx.service.car_class_count.load(Ordering::Relaxed),
        };

        if let Err(e) = app.emit(EVENT_TELEMETRY_SLOW, &slow) {
            warn!("Failed to emit slow telemetry bundle: {}", e);
        }

        // The inspector pulls this over a command instead of subscribing, so the
        // settings window never takes the bundle. Nothing is written — not even
        // the clone — while its panel is closed.
        if ctx.service.inspector_active.load(Ordering::Relaxed) {
            *lock_or_recover(&ctx.service.inspector_frame) = Some(frame.clone());
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

    let groups = plan(ctx.service.masks.entries());

    deliver(
        &ctx.service.publications,
        &ctx.service.delivery,
        ctx.due,
        bundle,
        groups,
        &mut TauriSink { app: ctx.app },
    );
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
/// on the wire once.
fn deliver(
    publications: &Mutex<PublicationRegistry>,
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
    let mut publications = lock_or_recover(publications);
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

        for recipient in &group.recipients {
            // Counted here rather than at assembly: what the counters answer is
            // what went on the wire, after the mask and after the repeat
            // suppression have both had their say.
            delivery.record(recipient.label(), &bundle);

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
}

/// Removes from `bundle` every demand-gated field the mask does not ask for.
///
/// The four 60 Hz fields are already left out at assembly, so for them this is
/// a no-op; stating all seven in one place is what makes the function a
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
}

fn count_car_classes(frame: &driver_entries::DriverEntriesFrame) -> u32 {
    let mut seen: Vec<i32> = Vec::new();

    for entry in &frame.entries {
        if !seen.contains(&entry.car_class_id) {
            seen.push(entry.car_class_id);
        }
    }

    seen.len() as u32
}

fn scatter_output(bundle: &mut TelemetryBundle, output: ComputedOutput) {
    match output {
        ComputedOutput::Fuel(frame) => bundle.fuel = Some(frame),
        ComputedOutput::LapDelta(frame) => bundle.lap_delta = Some(frame),
        ComputedOutput::LapLog(frame) => bundle.lap_log = Some(frame),
        ComputedOutput::PitStops(frame) => bundle.pit_stops = Some(frame),
        ComputedOutput::Proximity(frame) => bundle.proximity = Some(frame),
        ComputedOutput::Incidents(frame) => bundle.incidents = Some(frame),
        ComputedOutput::Relative(frame) => bundle.relative = Some(frame),
        ComputedOutput::DriverEntries(frame) => bundle.driver_entries = Some(frame),
        ComputedOutput::TrackRecording(frame) => bundle.track_recording = Some(frame),
        ComputedOutput::TrackShape(_) => {} // handled in Hz60 loop directly
        ComputedOutput::ReferenceLap(_) => {} // handled in Hz60 loop directly
        ComputedOutput::PitLanePct { .. } => {} // handled in Hz60 loop directly
    }
}

fn save_track_shape(app: &AppHandle, payload: &TrackShapePayload) {
    use std::fs;

    #[derive(serde::Serialize)]
    struct StoredTrack<'a> {
        version: u32,
        #[serde(flatten)]
        payload: &'a TrackShapePayload,
    }

    let Ok(data_dir) = app.path().app_data_dir() else {
        return;
    };

    let dir = data_dir.join("tracks");

    if fs::create_dir_all(&dir).is_err() {
        return;
    }

    let path = dir.join(format!("{}.json", payload.track_id));
    let stored = StoredTrack {
        version: 1,
        payload,
    };

    if let Ok(json) = serde_json::to_string(&stored) {
        let _ = fs::write(&path, json);
    }
}

/// Filesystem-safe key for a track+car reference lap file, shared with the
/// `get_reference_lap`/`delete_reference_lap` commands.
pub fn reference_lap_key(
    track_id: i32,
    car_screen_name: &str,
    condition: TrackCondition,
) -> String {
    let sanitized: String = car_screen_name
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();

    format!("{track_id}__{sanitized}__{}", condition.as_key())
}

fn save_reference_lap(app: &AppHandle, data: &ReferenceLapData) {
    use std::fs;

    #[derive(serde::Serialize)]
    struct StoredReferenceLap<'a> {
        version: u32,
        #[serde(flatten)]
        payload: &'a ReferenceLapData,
    }

    let Ok(data_dir) = app.path().app_data_dir() else {
        return;
    };

    let dir = data_dir.join("reference_laps");

    if fs::create_dir_all(&dir).is_err() {
        return;
    }

    let key = reference_lap_key(data.track_id, &data.car_screen_name, data.condition);
    let path = dir.join(format!("{key}.json"));
    let stored = StoredReferenceLap {
        version: 1,
        payload: data,
    };

    if let Ok(json) = serde_json::to_string(&stored) {
        let _ = fs::write(&path, json);
    }
}

fn patch_pit_lane_pct(app: &AppHandle, track_id: i32, pit_in_pct: f32, pit_exit_pct: f32) {
    use std::fs;
    use tracing::info;

    info!(
        "patch_pit_lane_pct triggered for track {} (in: {}, exit: {})",
        track_id, pit_in_pct, pit_exit_pct
    );

    let Ok(data_dir) = app.path().app_data_dir() else {
        warn!("Failed to resolve app data dir in patch_pit_lane_pct");
        return;
    };

    let path = data_dir.join("tracks").join(format!("{}.json", track_id));

    let Ok(bytes) = fs::read(&path) else {
        warn!("Failed to read track JSON file from {:?} in patch_pit_lane_pct (maybe track is not complete/recorded yet)", path);
        return;
    };

    let Ok(mut value) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
        warn!("Failed to parse track JSON from {:?}", path);
        return;
    };

    if let Some(obj) = value.as_object_mut() {
        obj.insert("pitInPct".to_string(), serde_json::json!(pit_in_pct));
        obj.insert("pitExitPct".to_string(), serde_json::json!(pit_exit_pct));
    }

    let Ok(json) = serde_json::to_string(&value) else {
        warn!("Failed to serialize patched JSON in patch_pit_lane_pct");
        return;
    };

    if fs::write(&path, &json).is_ok() {
        info!(
            "Successfully patched and saved pit lane calibration to {:?}",
            path
        );
        if let Ok(payload) = serde_json::from_str::<TrackShapePayload>(&json) {
            if let Err(e) = app.emit(EVENT_TRACK_SHAPE, &payload) {
                warn!("Failed to re-emit track shape after pit pct patch: {}", e);
            }
        }
    } else {
        warn!("Failed to write patched track JSON back to {:?}", path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::computations::driver_entries::DriverEntriesFrame;
    use crate::model::cars::CarPositionsFrame;
    use crate::telemetry::delivery::BROADCAST_LABEL;
    use crate::telemetry::masks::{BOOTSTRAP_LABEL, REMOTE_LABEL};
    use crate::telemetry::state::{EVENT_CAR_POSITIONS, EVENT_DRIVER_ENTRIES};

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
        publications: Mutex<PublicationRegistry>,
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
                publications: Mutex::new(PublicationRegistry::default()),
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
                &self.publications,
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
