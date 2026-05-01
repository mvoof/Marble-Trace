/// iRacing telemetry service — connection management and data streaming.
///
/// Manages the lifecycle of the iRacing telemetry connection:
/// - Connects to iRacing via pitwall `LiveConnection`
/// - Reads ALL telemetry variables in a single `AllFieldsFrame` per tick
/// - Decomposes into domain-specific frames and emits as separate Tauri events
/// - Handles session info updates (YAML) via a separate stream
/// - Auto-reconnects on disconnect
///
/// Tauri events emitted (raw domain frames):
/// - `iracing://telemetry/car-dynamics` — CarDynamicsFrame (60Hz)
/// - `iracing://telemetry/car-inputs` — CarInputsFrame (60Hz)
/// - `iracing://telemetry/car-status` — CarStatusFrame (4Hz)
/// - `iracing://telemetry/lap-timing` — LapTimingFrame (10Hz)
/// - `iracing://telemetry/session` — SessionFrame (1Hz)
/// - `iracing://telemetry/environment` — EnvironmentFrame (1Hz)
/// - `iracing://telemetry/chassis` — ChassisFrame (10Hz)
/// - `iracing://session-info` — pitwall SessionInfo (on YAML change)
/// - `iracing://status` — connection status string
/// - `iracing://disconnected` — disconnect signal
///
/// Computed events:
/// - `iracing://computed/proximity` — ProximityFrame (10Hz)
/// - `iracing://computed/fuel` — FuelComputedFrame (4Hz)
/// - `iracing://computed/standings` — DriverEntriesFrame (10Hz)
/// - `iracing://computed/pit-stops` — PitStopsFrame (4Hz)
/// - `iracing://computed/lap-delta` — LapDeltaFrame (60Hz)
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures::StreamExt;
use pitwall::{Pitwall, SessionInfo, UpdateRate};
use serde_json::Value as JsonValue;
use std::panic::AssertUnwindSafe;
use tauri::{AppHandle, Emitter, State};
use tokio::time::sleep;
use tracing::{debug, info, warn};

use super::frames::{
    AllFieldsFrame, CarDynamicsFrame, CarIdxFrame, CarInputsFrame, CarPositionsFrame,
    CarStatusFrame, ChassisFrame, EnvironmentFrame, LapTimingFrame, SessionFrame,
};
use super::weather_forecast::parse_weather_forecast;
use crate::computations::{
    fuel, fuel::FuelState, lap_delta, lap_delta::LapDeltaState, pit_stops::PitStopsFrame, proximity, standings, standings::StandingsState,
};

/// Shared state for the iRacing telemetry service.
pub struct TelemetryServiceState {
    pub running: AtomicBool,
    pub last_session_info: Mutex<Option<Arc<SessionInfo>>>,
    /// Start grid positions keyed by carIdx: (overall_pos, class_pos), 1-indexed.
    pub start_positions: Mutex<HashMap<i32, (i32, i32)>>,
    /// Cached track length in meters.
    pub track_length_m: Mutex<Option<f32>>,
}

/// Shared state for pit stop tracking.
pub struct PitStopState {
    /// Player pit stop counter for the current session.
    pub count: AtomicU32,
    /// Whether the player was on pit road on the previous frame.
    pub was_on_pit_road: AtomicBool,
    /// Session number tracked for pit stop reset.
    pub tracked_session_num: AtomicI32,
}

/// Shared state for various computations (lap delta, fuel, standings).
pub struct ComputationState {
    /// Stateful lap delta / sector timing computation.
    pub lap_delta: Mutex<LapDeltaState>,
    /// Stateful standings computation.
    pub standings: Mutex<StandingsState>,
    /// Stateful fuel computation (lap history, avg, session tracking).
    pub fuel: Mutex<FuelState>,
    /// User-configured pit warning laps (stored as bits of f32).
    pub pit_warning_laps: AtomicU32,
}

/// Compose domain-specific states.
pub struct TelemetryState {
    pub service: Arc<TelemetryServiceState>,
    pub pit: Arc<PitStopState>,
    pub computation: Arc<ComputationState>,
}

struct EmitContext<'a> {
    app: &'a AppHandle,
    frame: &'a AllFieldsFrame,
    tick: u64,
    service: &'a TelemetryServiceState,
    pit: &'a PitStopState,
    computation: &'a ComputationState,
}

#[tauri::command]
pub async fn get_last_session_info(
    state: State<'_, TelemetryState>,
) -> Result<Option<JsonValue>, String> {
    let lock = state
        .service
        .last_session_info
        .lock()
        .unwrap_or_else(|e| e.into_inner());

    match lock.as_deref() {
        None => Ok(None),
        Some(session) => match serde_json::to_value(session) {
            Ok(raw) => Ok(Some(sanitize_json(raw))),
            Err(e) => Err(format!("Failed to serialize session info: {e}")),
        },
    }
}

#[tauri::command]
pub async fn set_pit_warning_laps(
    state: State<'_, TelemetryState>,
    laps: f32,
) -> Result<(), String> {
    state
        .computation
        .pit_warning_laps
        .store(laps.to_bits(), Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn start_telemetry_stream(
    app: AppHandle,
    state: State<'_, TelemetryState>,
) -> Result<(), String> {
    state.service.running.store(false, Ordering::SeqCst);
    sleep(Duration::from_millis(50)).await;

    state.service.running.store(true, Ordering::SeqCst);

    let service = state.service.clone();
    let pit = state.pit.clone();
    let computation = state.computation.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        loop {
            if !service.running.load(Ordering::SeqCst) {
                debug!("Stream stopped by user");
                break;
            }

            app_clone.emit("iracing://status", "waiting").ok();
            info!("Waiting for iRacing...");

            let connection = loop {
                if !service.running.load(Ordering::SeqCst) {
                    return;
                }

                match Pitwall::connect().await {
                    Ok(conn) => break conn,
                    Err(e) => {
                        debug!("iRacing connect failed: {e}");
                        sleep(Duration::from_secs(1)).await;
                    }
                }
            };

            // Guard: catch subscribe() panic if schema is incomplete (e.g. iRacing still initializing).
            // A panic inside tokio::spawn silently kills this task, so we catch it and retry instead.
            let subscribe_result = std::panic::catch_unwind(AssertUnwindSafe(|| {
                connection.subscribe::<AllFieldsFrame>(UpdateRate::Native)
            }));

            let telemetry_stream = match subscribe_result {
                Ok(stream) => stream,
                Err(_) => {
                    warn!("subscribe() panicked — schema incomplete, retrying in 1s...");
                    sleep(Duration::from_secs(1)).await;
                    continue;
                }
            };

            info!("Shared memory mapped, waiting for active session...");

            let session_stream = connection.session_updates();

            debug!("Subscribed to telemetry and session streams");

            let app_session = app_clone.clone();
            let service_session = service.clone();

            let session_task = tokio::spawn(async move {
                let mut stream = std::pin::pin!(session_stream);

                while let Some(session) = stream.next().await {
                    if !service_session.running.load(Ordering::SeqCst) {
                        break;
                    }

                    info!(
                        has_driver_info = session.driver_info.is_some(),
                        track = %session.weekend_info.track_display_name,
                        "Session info updated"
                    );

                    // Update start positions from ResultsPositions if available
                    update_start_positions(&session, &service_session.start_positions);

                    // Update cached track length
                    if let Ok(mut lock) = service_session.track_length_m.lock() {
                        *lock = Some(proximity::parse_track_length(
                            &session.weekend_info.track_length,
                        ));
                    }

                    if let Ok(mut lock) = service_session.last_session_info.lock() {
                        *lock = Some(session.clone());
                    }

                    emit_session_info(&app_session, &session);

                    let forecast = parse_weather_forecast(&session.weekend_info.unknown_fields);
                    if !forecast.is_empty() {
                        debug!("Weather forecast parsed successfully, {} entries", forecast.len());
                        if let Err(e) = app_session.emit("iracing://weather-forecast", &forecast) {
                            warn!("Failed to emit weather forecast: {}", e);
                        }
                    } else {
                        debug!("Weather forecast empty after parsing from unknown_fields");
                    }
                }

                debug!("Session stream ended");
            });

            let mut stream = std::pin::pin!(telemetry_stream);
            let mut tick: u64 = 0;

            loop {
                if !service.running.load(Ordering::SeqCst) {
                    debug!("Stream stopped by user");
                    return;
                }

                match tokio::time::timeout(Duration::from_secs(3), stream.next()).await {
                    Ok(Some(frame)) => {
                        tick += 1;

                        if tick == 1 {
                            info!(
                                speed = frame.speed,
                                rpm = frame.rpm,
                                gear = frame.gear,
                                "Connected to iRacing — first telemetry frame received"
                            );
                            app_clone.emit("iracing://status", "connected").ok();
                        }

                        let ctx = EmitContext {
                            app: &app_clone,
                            frame: &frame,
                            tick,
                            service: &service,
                            pit: &pit,
                            computation: &computation,
                        };

                        emit_domain_frames(ctx);
                    }
                    Ok(None) => {
                        break;
                    }
                    Err(_) => {
                        let is_running = is_iracing_running();

                        if !is_running {
                            warn!("iRacingSim64.exe is not running. Disconnecting.");
                            break;
                        } else {
                            debug!("No telemetry for 3s, but process is running. Waiting...");
                        }
                    }
                }
            }

            session_task.abort();

            info!(tick, "Stream ended, will retry connection...");

            if let Ok(mut lock) = service.last_session_info.lock() {
                *lock = None;
            }

            // Reset pit stop state on disconnect
            pit.count.store(0, Ordering::Relaxed);
            pit.was_on_pit_road.store(false, Ordering::Relaxed);
            pit.tracked_session_num.store(-1, Ordering::Relaxed);
            if let Ok(mut s) = computation.lap_delta.lock() {
                s.reset();
            }
            if let Ok(mut t) = service.track_length_m.lock() {
                *t = None;
            }

            app_clone.emit("iracing://status", "disconnected").ok();
            app_clone.emit("iracing://disconnected", &()).ok();

            if !service.running.load(Ordering::SeqCst) {
                break;
            }
            // Outer loop continues: retries Pitwall::connect() until iRacing is back
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_telemetry_stream(state: State<'_, TelemetryState>) -> Result<(), String> {
    state.service.running.store(false, Ordering::SeqCst);
    debug!("Telemetry stream stopped");
    Ok(())
}

/// Sanitizes a JSON value by replacing NaN and Infinity with null.
/// iRacing YAML can contain NaN float values (e.g. lap times before any lap is completed)
/// which are valid YAML but fail JSON serialization.
fn sanitize_json(value: JsonValue) -> JsonValue {
    match value {
        JsonValue::Number(n) => {
            if let Some(f) = n.as_f64() {
                if f.is_nan() || f.is_infinite() {
                    return JsonValue::Null;
                }
            }
            JsonValue::Number(n)
        }
        JsonValue::Array(arr) => JsonValue::Array(arr.into_iter().map(sanitize_json).collect()),
        JsonValue::Object(obj) => {
            JsonValue::Object(obj.into_iter().map(|(k, v)| (k, sanitize_json(v))).collect())
        }
        other => other,
    }
}

/// Emits a SessionInfo event, sanitizing any NaN/Infinity values that iRacing YAML may contain.
fn emit_session_info(app: &AppHandle, session: &SessionInfo) {
    match serde_json::to_value(session) {
        Ok(raw) => {
            let sanitized = sanitize_json(raw);
            if let Err(e) = app.emit("iracing://session-info", sanitized) {
                warn!("Failed to emit session info: {}", e);
            }
        }
        Err(e) => {
            warn!("Failed to serialize session info: {}", e);
        }
    }
}

/// Updates start_positions from session.ResultsPositions on each session change.
fn update_start_positions(
    session: &SessionInfo,
    start_positions: &Mutex<HashMap<i32, (i32, i32)>>,
) {
    let current_num = session.session_info.current_session_num as usize;
    let results = session
        .session_info
        .sessions
        .get(current_num)
        .and_then(|s| s.results_positions.as_deref());

    if let Some(results) = results {
        if results.is_empty() {
            return;
        }
        let new_positions = standings::parse_start_positions(results);
        if !new_positions.is_empty() {
            if let Ok(mut lock) = start_positions.lock() {
                *lock = new_positions;
            }
        }
    }
}

fn emit_domain_frames(ctx: EmitContext<'_>) {
    let app = ctx.app;
    let frame = ctx.frame;
    let tick = ctx.tick;

    // 60 Hz — raw frames
    if let Err(e) = app.emit(
        "iracing://telemetry/car-dynamics",
        &CarDynamicsFrame::from(frame),
    ) {
        warn!("Failed to emit car dynamics: {}", e);
    }
    if let Err(e) = app.emit(
        "iracing://telemetry/car-inputs",
        &CarInputsFrame::from(frame),
    ) {
        warn!("Failed to emit car inputs: {}", e);
    }

    // Clone session_info Arc — cheap enough to do at 60Hz for accurate computations
    let session_snapshot = ctx
        .service
        .last_session_info
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone();
    let session_info = session_snapshot.as_deref();

    // Compute stateful data at 60Hz for maximum precision (especially sector timing)
    let lap_delta_frame = session_info.map(|session| {
        lap_delta::compute(frame, session, &ctx.computation.lap_delta)
    });

    // 60 Hz — emit lap delta for smooth live delta updates
    if let Some(ref ldf) = lap_delta_frame {
        if let Err(e) = app.emit("iracing://computed/lap-delta", ldf) {
            warn!("Failed to emit lap delta: {}", e);
        }
    }

    // 60 Hz — lightweight car positions for smooth map/relative rendering
    if let Err(e) = app.emit(
        "iracing://telemetry/car-positions",
        &CarPositionsFrame::from(frame),
    ) {
        warn!("Failed to emit car positions: {}", e);
    }

    // 10 Hz — also fire on first frame so widgets populate immediately
    if tick.is_multiple_of(6) || tick == 1 {
        if let Err(e) = app.emit("iracing://telemetry/car-idx", &CarIdxFrame::from(frame)) {
            warn!("Failed to emit car idx: {}", e);
        }
        if let Err(e) = app.emit("iracing://telemetry/chassis", &ChassisFrame::from(frame)) {
            warn!("Failed to emit chassis: {}", e);
        }
        if let Err(e) = app.emit(
            "iracing://telemetry/lap-timing",
            &LapTimingFrame::from(frame),
        ) {
            warn!("Failed to emit lap timing: {}", e);
        }

        // Computed: proximity & standings (10 Hz)
        if let Some(session) = session_info {
            let track_length = ctx
                .service
                .track_length_m
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .unwrap_or(0.0);
            let proximity = proximity::compute(frame, session, track_length);
            if let Err(e) = app.emit("iracing://computed/proximity", &proximity) {
                warn!("Failed to emit proximity: {}", e);
            }

            let start_pos_snapshot = ctx
                .service
                .start_positions
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .clone();
            let standings_frame =
                standings::compute(frame, session, &start_pos_snapshot, true, &ctx.computation.standings);
            if let Err(e) = app.emit("iracing://computed/standings", &standings_frame) {
                warn!("Failed to emit standings: {}", e);
            }

        }
    }

    // 4 Hz
    if tick.is_multiple_of(15) || tick == 1 {
        if let Err(e) = app.emit(
            "iracing://telemetry/car-status",
            &CarStatusFrame::from(frame),
        ) {
            warn!("Failed to emit car status: {}", e);
        }

        // Computed: fuel & pit stops (4 Hz)
        if let Some(session) = session_info {
            let pit_warning_laps = f32::from_bits(ctx.computation.pit_warning_laps.load(Ordering::Relaxed));

            {
                let mut state = ctx.computation.fuel.lock().unwrap_or_else(|e| e.into_inner());
                let current_lap = frame.lap.unwrap_or(-1);
                let session_num = frame.session_num.unwrap_or(-1);
                state.update(current_lap, frame.fuel_level, session_num);
            }

            let fuel_frame = {
                let state = ctx.computation.fuel.lock().unwrap_or_else(|e| e.into_inner());
                fuel::compute(frame, session, frame.session_num, pit_warning_laps, &state)
            };
            if let Some(fuel_frame) = fuel_frame {
                if let Err(e) = app.emit("iracing://computed/fuel", &fuel_frame) {
                    warn!("Failed to emit fuel: {}", e);
                }
            }

            // Pit stop tracking
            let player_idx = session
                .driver_info
                .as_ref()
                .and_then(|di| di.driver_car_idx)
                .unwrap_or(-1);

            if player_idx >= 0 {
                let current_session_num = frame.session_num.unwrap_or(-1);
                let tracked_session = ctx.pit.tracked_session_num.load(Ordering::Relaxed);

                if current_session_num != tracked_session {
                    ctx.pit.tracked_session_num.store(current_session_num, Ordering::Relaxed);
                    ctx.pit.count.store(0, Ordering::Relaxed);
                    ctx.pit.was_on_pit_road.store(false, Ordering::Relaxed);
                }

                let on_pit = frame
                    .car_idx_on_pit_road
                    .get(player_idx as usize)
                    .copied()
                    .unwrap_or(false);
                let was = ctx.pit.was_on_pit_road.load(Ordering::Relaxed);

                if on_pit && !was {
                    ctx.pit.count.fetch_add(1, Ordering::Relaxed);
                }
                ctx.pit.was_on_pit_road.store(on_pit, Ordering::Relaxed);

                let stops = ctx.pit.count.load(Ordering::Relaxed);
                let pit_frame = PitStopsFrame {
                    player_stops: stops,
                };
                if let Err(e) = app.emit("iracing://computed/pit-stops", &pit_frame) {
                    warn!("Failed to emit pit stops: {}", e);
                }
            }
        }
    }

    // 1 Hz
    if tick.is_multiple_of(60) || tick == 1 {
        if let Err(e) = app.emit("iracing://telemetry/session", &SessionFrame::from(frame)) {
            warn!("Failed to emit session: {}", e);
        }
        if let Err(e) = app.emit(
            "iracing://telemetry/environment",
            &EnvironmentFrame::from(frame),
        ) {
            warn!("Failed to emit environment: {}", e);
        }
    }
}

fn is_iracing_running() -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    std::process::Command::new("tasklist")
        .arg("/FI")
        .arg("IMAGENAME eq iRacingSim64.exe")
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("iRacingSim64.exe"))
        .unwrap_or(false)
}
