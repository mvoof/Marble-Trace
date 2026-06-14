/// Event names, `TelemetryBundle` assembly and emission.
///
/// Receives the adapted frame plus the due emit groups from the scheduler,
/// runs the computations via `ProcessorRegistry` and emits a single bundle
/// event per tick.
use std::sync::atomic::Ordering;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};
use tracing::warn;

use super::scheduler::DueGroups;
use super::state::{
    TelemetryServiceState, EVENT_CAR_DYNAMICS, EVENT_CAR_INPUTS, EVENT_CAR_POSITIONS,
    EVENT_LAP_DELTA,
};
use crate::capabilities::Capabilities;
use crate::computations::{
    fuel, lap_delta, pit_stops, proximity, standings, ComputeContext, ComputedOutput,
    ProcessorRegistry, TickRate,
};
use crate::model::cars::{CarIdxFrame, CarPositionsFrame};
use crate::model::environment::EnvironmentFrame;
use crate::model::lap_log::LapLogFrame;
use crate::model::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame,
};
use crate::model::relative::RelativeFrame;
use crate::model::session::SessionFrame;
use crate::model::track_shape::{TrackRecordingFrame, TrackShapePayload};
use crate::sources::source::SourceFrame;
use crate::utils::lock_or_recover;

pub const EVENT_TRACK_SHAPE: &str = "sim://track-shape";
pub const EVENT_CAPABILITIES: &str = "sim://capabilities";
pub const EVENT_TELEMETRY_BUNDLE: &str = "sim://telemetry/bundle";
pub const EVENT_SESSION_INFO: &str = "sim://session";
pub const EVENT_WEATHER_FORECAST: &str = "sim://weather";
pub const EVENT_STATUS: &str = "sim://status";
pub const EVENT_DISCONNECTED: &str = "sim://disconnected";

pub struct EmitContext<'a> {
    pub app: &'a AppHandle,
    pub frame: &'a SourceFrame,
    pub due: DueGroups,
    pub service: &'a TelemetryServiceState,
    pub registry: &'a Mutex<ProcessorRegistry>,
    pub pit_warning_laps: f32,
    pub capabilities: Capabilities,
}

#[derive(Debug, serde::Serialize, Clone)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
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
    pub relative: Option<RelativeFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub standings: Option<standings::DriverEntriesFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub car_status: Option<CarStatusFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fuel: Option<fuel::FuelComputedFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pit_stops: Option<pit_stops::PitStopsFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lap_log: Option<LapLogFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session: Option<SessionFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<EnvironmentFrame>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub track_recording: Option<TrackRecordingFrame>,
}

pub fn emit_domain_frames(ctx: EmitContext<'_>) {
    let app = ctx.app;
    let frame = ctx.frame;
    let due = ctx.due;

    let active_mask = ctx.service.active_events.load(Ordering::Relaxed);
    let mut bundle = TelemetryBundle {
        car_dynamics: None,
        car_inputs: None,
        car_positions: None,
        lap_delta: None,
        car_idx: None,
        chassis: None,
        lap_timing: None,
        proximity: None,
        relative: None,
        standings: None,
        car_status: None,
        fuel: None,
        pit_stops: None,
        lap_log: None,
        session: None,
        environment: None,
        track_recording: None,
    };

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
            car_idx: &frame.car_idx,
            lap_timing: &frame.lap_timing,
            car_status: &frame.car_status,
            session,
            track_length_m: track_length,
            car_length_m: car_length,
            start_positions: &start_pos_snapshot,
            pit_warning_laps: ctx.pit_warning_laps,
            lap_delta_active: (active_mask & EVENT_LAP_DELTA) != 0,
            session_num: frame.session.session_num,
            session_time_remain: frame.session.session_time_remain,
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
                other => scatter_output(&mut bundle, other),
            }
        }

        if due.hz10 {
            for output in registry.run(TickRate::Hz10, ctx.capabilities, &compute_ctx) {
                scatter_output(&mut bundle, output);
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
    }

    if due.hz1 {
        bundle.session = Some(frame.session.clone());
        bundle.environment = Some(frame.environment.clone());
    }

    let should_emit = active_mask != 0 || due.first || due.hz10 || due.hz4 || due.hz1;

    if should_emit {
        if let Err(e) = app.emit(EVENT_TELEMETRY_BUNDLE, &bundle) {
            warn!("Failed to emit telemetry bundle: {}", e);
        }
    }
}

fn scatter_output(bundle: &mut TelemetryBundle, output: ComputedOutput) {
    match output {
        ComputedOutput::Fuel(frame) => bundle.fuel = Some(frame),
        ComputedOutput::LapDelta(frame) => bundle.lap_delta = Some(frame),
        ComputedOutput::LapLog(frame) => bundle.lap_log = Some(frame),
        ComputedOutput::PitStops(frame) => bundle.pit_stops = Some(frame),
        ComputedOutput::Proximity(frame) => bundle.proximity = Some(frame),
        ComputedOutput::Relative(frame) => bundle.relative = Some(frame),
        ComputedOutput::Standings(frame) => bundle.standings = Some(frame),
        ComputedOutput::TrackRecording(frame) => bundle.track_recording = Some(frame),
        ComputedOutput::TrackShape(_) => {} // handled in Hz60 loop directly
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
