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
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures::StreamExt;
use pitwall::{Pitwall, SessionInfo, UpdateRate};
use serde_json::Value as JsonValue;
use serde_yaml_ng;
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
    fuel, fuel::FuelState, lap_delta, lap_delta::LapDeltaState, pit_stops, pit_stops::PitStopState,
    proximity, standings, standings::StandingsState,
};
use crate::utils::lock_or_recover;

/// Shared state for the iRacing telemetry service.
pub struct TelemetryServiceState {
    pub running: AtomicBool,
    pub last_session_info: Mutex<Option<Arc<SessionInfo>>>,
    /// Start grid positions keyed by carIdx: (overall_pos, class_pos), 1-indexed.
    pub start_positions: Mutex<HashMap<i32, (i32, i32)>>,
    /// Cached track length in meters.
    pub track_length_m: Mutex<Option<f32>>,
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
    let lock = lock_or_recover(&state.service.last_session_info);

    match lock.as_deref() {
        None => Ok(None),
        Some(session) => {
            // Use YAML as intermediate to safely handle NaNs
            match serde_yaml_ng::to_value(session) {
                Ok(yaml_val) => Ok(Some(yaml_to_json(yaml_val))),
                Err(e) => Err(format!(
                    "Failed to serialize session info to YAML value: {e}"
                )),
            }
        }
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
    info!("start_telemetry_stream command received");
    state.service.running.store(false, Ordering::SeqCst);
    sleep(Duration::from_millis(50)).await;

    state.service.running.store(true, Ordering::SeqCst);

    let service = state.service.clone();
    let pit = state.pit.clone();
    let computation = state.computation.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        info!("Main telemetry loop task started");
        loop {
            if !service.running.load(Ordering::SeqCst) {
                info!("Main telemetry loop stopping (service not running)");
                break;
            }

            app_clone.emit("iracing://status", "waiting").ok();
            info!("Waiting for iRacing connection...");

            let Some(connection) = wait_for_connection(&service).await else {
                return;
            };

            info!("Connected to iRacing shared memory");

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

            let session_task = spawn_session_polling(app_clone.clone(), service.clone());

            let mut stream = std::pin::pin!(telemetry_stream);
            run_telemetry_loop(&app_clone, stream.as_mut(), &service, &pit, &computation).await;

            session_task.abort();
            info!("Stream ended, will retry connection...");
            reset_telemetry_state(&app_clone, &service, &pit, &computation);

            if !service.running.load(Ordering::SeqCst) {
                break;
            }
        }
    });

    Ok(())
}

async fn wait_for_connection(service: &TelemetryServiceState) -> Option<pitwall::LiveConnection> {
    loop {
        if !service.running.load(Ordering::SeqCst) {
            return None;
        }

        match Pitwall::connect().await {
            Ok(conn) => return Some(conn),
            Err(e) => {
                debug!("iRacing connect failed: {e}");
                sleep(Duration::from_secs(1)).await;
            }
        }
    }
}

fn spawn_session_polling(
    app: AppHandle,
    service: Arc<TelemetryServiceState>,
) -> tokio::task::JoinHandle<()> {
    debug!("Spawning session polling task...");
    tokio::spawn(async move {
        debug!("Session polling task spawned and running");
        let mut last_version = -1;
        // Since Pitwall::connect() succeeded, we know shared memory is accessible.
        // We create a direct WindowsConnection for robust session info polling
        // because pitwall's internal session stream fails on problematic YAML.
        let mut win_conn = pitwall::WindowsConnection::try_connect().ok();

        if win_conn.is_some() {
            debug!("Session polling task: WindowsConnection established");
        } else {
            warn!("Session polling task: Failed to establish WindowsConnection (will retry)");
        }

        loop {
            if !service.running.load(Ordering::SeqCst) {
                debug!("Session polling task: Stopping (service inactive)");
                break;
            }

            if let Some(conn) = &win_conn {
                let header = conn.header();
                let current_version = header.session_info_update;

                if current_version != last_version {
                    debug!(
                        "Session version change: {} -> {}. Header info: offset={}, len={}",
                        last_version,
                        current_version,
                        header.session_info_offset,
                        header.session_info_len
                    );

                    if let Some(raw_yaml) = conn.session_info() {
                        debug!(
                            "Session polling task: Fetched raw YAML ({} bytes)",
                            raw_yaml.len()
                        );
                        match pitwall::preprocess_iracing_yaml(&raw_yaml) {
                            Ok(preprocessed) => {
                                debug!(
                                    "Session polling task: YAML preprocessed ({} bytes)",
                                    preprocessed.len()
                                );
                                match serde_yaml_ng::from_str::<SessionInfo>(&preprocessed) {
                                    Ok(session) => {
                                        info!(
                                            track = %session.weekend_info.track_display_name,
                                            version = current_version,
                                            "Session info updated"
                                        );

                                        // Update start positions from ResultsPositions if available
                                        update_start_positions(&session, &service.start_positions);

                                        // Update cached track length
                                        if let Ok(mut lock) = service.track_length_m.lock() {
                                            *lock = Some(proximity::parse_track_length(
                                                &session.weekend_info.track_length,
                                            ));
                                        }

                                        if let Ok(mut lock) = service.last_session_info.lock() {
                                            *lock = Some(Arc::new(session.clone()));
                                        }

                                        emit_session_info(&app, &session);

                                        let forecast = parse_weather_forecast(
                                            &session.weekend_info.unknown_fields,
                                        );
                                        if !forecast.is_empty() {
                                            debug!(
                                                "Weather forecast: {} entries emitted",
                                                forecast.len()
                                            );
                                            if let Err(e) =
                                                app.emit("iracing://weather-forecast", &forecast)
                                            {
                                                warn!("Failed to emit weather forecast: {}", e);
                                            }
                                        }

                                        last_version = current_version;
                                    }
                                    Err(e) => {
                                        warn!(
                                            "Session polling task: YAML parse error (version {}): {}. YAML snippet: {:.100}",
                                            current_version, e, preprocessed
                                        );
                                        // Still update version to avoid spamming the same error
                                        last_version = current_version;
                                    }
                                }
                            }
                            Err(e) => {
                                warn!("Failed to preprocess session info YAML: {}", e);
                                last_version = current_version;
                            }
                        }
                    } else {
                        warn!(
                            "Session polling task: conn.session_info() returned None. Offset: {}, Len: {}",
                            header.session_info_offset, header.session_info_len
                        );
                        // Update last_version anyway to avoid tight loop warning spam
                        last_version = current_version;
                    }
                }
            } else {
                win_conn = pitwall::WindowsConnection::try_connect().ok();
                if win_conn.is_some() {
                    debug!("Session polling task: WindowsConnection re-established");
                }
            }

            sleep(Duration::from_millis(500)).await;
        }
        debug!("Session polling task exited");
    })
}

async fn run_telemetry_loop<S>(
    app: &AppHandle,
    mut stream: std::pin::Pin<&mut S>,
    service: &Arc<TelemetryServiceState>,
    pit: &Arc<PitStopState>,
    computation: &Arc<ComputationState>,
) where
    S: futures::Stream<Item = AllFieldsFrame>,
{
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
                    app.emit("iracing://status", "connected").ok();
                }

                let ctx = EmitContext {
                    app,
                    frame: &frame,
                    tick,
                    service,
                    pit,
                    computation,
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
}

fn reset_telemetry_state(
    app: &AppHandle,
    service: &Arc<TelemetryServiceState>,
    pit: &Arc<PitStopState>,
    computation: &Arc<ComputationState>,
) {
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

    app.emit("iracing://status", "disconnected").ok();
    app.emit("iracing://disconnected", &()).ok();
}

#[tauri::command]
pub async fn stop_telemetry_stream(state: State<'_, TelemetryState>) -> Result<(), String> {
    state.service.running.store(false, Ordering::SeqCst);
    debug!("Telemetry stream stopped");
    Ok(())
}

/// Recursively converts a serde_yaml_ng::Value to a serde_json::Value,
/// explicitly handling NaN and Infinity by converting them to Null.
fn yaml_to_json(val: serde_yaml_ng::Value) -> JsonValue {
    match val {
        serde_yaml_ng::Value::Null => JsonValue::Null,
        serde_yaml_ng::Value::Bool(b) => JsonValue::Bool(b),
        serde_yaml_ng::Value::Number(n) => {
            if let Some(f) = n.as_f64() {
                if f.is_finite() {
                    serde_json::Number::from_f64(f)
                        .map(JsonValue::Number)
                        .unwrap_or(JsonValue::Null)
                } else {
                    JsonValue::Null
                }
            } else if let Some(i) = n.as_i64() {
                JsonValue::Number(i.into())
            } else if let Some(u) = n.as_u64() {
                JsonValue::Number(u.into())
            } else {
                JsonValue::Null
            }
        }
        serde_yaml_ng::Value::String(s) => JsonValue::String(s),
        serde_yaml_ng::Value::Sequence(seq) => {
            JsonValue::Array(seq.into_iter().map(yaml_to_json).collect())
        }
        serde_yaml_ng::Value::Mapping(map) => {
            let mut obj = serde_json::Map::new();
            for (k, v) in map {
                if let Some(key) = k.as_str() {
                    obj.insert(key.to_string(), yaml_to_json(v));
                }
            }
            JsonValue::Object(obj)
        }
        serde_yaml_ng::Value::Tagged(t) => yaml_to_json(t.value),
    }
}

/// Emits a SessionInfo event, sanitizing any NaN/Infinity values that iRacing YAML may contain.
/// Uses a custom YAML-to-JSON converter to safely handle non-finite floats.
fn emit_session_info(app: &AppHandle, session: &SessionInfo) {
    match serde_yaml_ng::to_value(session) {
        Ok(yaml_val) => {
            let sanitized_json = yaml_to_json(yaml_val);
            let json_str = serde_json::to_string(&sanitized_json).unwrap_or_default();
            let size_kb = json_str.len() as f64 / 1024.0;

            info!("Attempting to emit SessionInfo: {:.2} KB", size_kb);

            match app.emit("iracing://session-info", &sanitized_json) {
                Ok(_) => info!("SessionInfo event emitted successfully ({:.2} KB)", size_kb),
                Err(e) => warn!(
                    "CRITICAL: Failed to emit session info ({:.2} KB): {}",
                    size_kb, e
                ),
            }
        }
        Err(e) => {
            warn!("Failed to serialize session info to YAML value: {}", e);
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
    let session_snapshot = lock_or_recover(&ctx.service.last_session_info).clone();
    let session_info = session_snapshot.as_deref();

    // Compute stateful data at 60Hz for maximum precision (especially sector timing)
    let lap_delta_frame =
        session_info.map(|session| lap_delta::compute(frame, session, &ctx.computation.lap_delta));

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
            let track_length = lock_or_recover(&ctx.service.track_length_m).unwrap_or(0.0);
            let proximity = proximity::compute(frame, session, track_length);
            if let Err(e) = app.emit("iracing://computed/proximity", &proximity) {
                warn!("Failed to emit proximity: {}", e);
            }

            let start_pos_snapshot = lock_or_recover(&ctx.service.start_positions).clone();
            let standings_frame = standings::compute(
                frame,
                session,
                &start_pos_snapshot,
                true,
                &ctx.computation.standings,
            );
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
            let pit_warning_laps =
                f32::from_bits(ctx.computation.pit_warning_laps.load(Ordering::Relaxed));

            {
                let mut state = lock_or_recover(&ctx.computation.fuel);
                let current_lap = frame.lap.unwrap_or(-1);
                let session_num = frame.session_num.unwrap_or(-1);
                state.update(current_lap, frame.fuel_level, session_num);
            }

            let fuel_frame = {
                let state = lock_or_recover(&ctx.computation.fuel);
                fuel::compute(frame, session, frame.session_num, pit_warning_laps, &state)
            };
            if let Some(fuel_frame) = fuel_frame {
                if let Err(e) = app.emit("iracing://computed/fuel", &fuel_frame) {
                    warn!("Failed to emit fuel: {}", e);
                }
            }

            // Pit stop tracking
            if let Some(pit_frame) = pit_stops::compute(frame, session, ctx.pit) {
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

// when the connection to iRacing was lost, tasklist.exe was launched via std::process::Command without the CREATE_NO_WINDOW flag.
// Windows displayed a console window for a split second, even though windows_subsystem = "windows" in main.rs—this attribute
// hides the console only for the application process itself, not for child processes.
// Fix: Moved the call to the is_iracing_running() function with the .creation_flags(0x08000000) (CREATE_NO_WINDOW) flag
// via std::os::windows::process::CommandExt
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
