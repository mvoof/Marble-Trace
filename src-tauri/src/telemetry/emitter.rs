/// Event names, `TelemetryBundle` assembly and emission.
///
/// Receives the adapted frame plus the due emit groups from the scheduler,
/// runs the computations via `ProcessorRegistry` and emits a single bundle
/// event per tick.
use std::sync::atomic::Ordering;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};
use tracing::warn;

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
    EVENT_SIM_PERF, EVENT_STATUS, EVENT_TELEMETRY_BUNDLE, EVENT_TELEMETRY_SLOW, EVENT_TRACK_SHAPE,
    EVENT_WEATHER_FORECAST,
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

    let active_mask = ctx.service.active_events.load(Ordering::Relaxed);
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
    // instead of rebuilding them from the tick it became visible.
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

    // Round to what a widget can actually draw, then drop whatever is identical
    // to the last thing published. Order matters both ways: rounding before the
    // comparison is what makes repeats compare equal at all, and both run after
    // the gating above so a field the mask removed is never recorded as sent.
    quantize_bundle(&mut bundle);

    // The 1 Hz tier carries a full bundle. See `publications` — it is what a
    // window that just reloaded, or a phone that just opened a remote screen,
    // needs in order to paint anything at all.
    lock_or_recover(&ctx.service.publications).prune(&mut bundle, due.first || due.hz1);

    let should_emit = active_mask != 0 || due.first || due.hz10 || due.hz4 || due.hz1;

    if should_emit {
        if let Err(e) = app.emit(EVENT_TELEMETRY_BUNDLE, &bundle) {
            warn!("Failed to emit telemetry bundle: {}", e);
        }
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
