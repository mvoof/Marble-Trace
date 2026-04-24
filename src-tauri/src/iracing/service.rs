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
/// - `iracing://computed/lap-delta` — LapDeltaFrame (10Hz)
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures::StreamExt;
use pitwall::{Pitwall, SessionInfo, UpdateRate};
use tauri::{AppHandle, Emitter, State};
use tokio::time::sleep;
use tracing::{debug, info, warn};

use super::frames::{
    AllFieldsFrame, CarDynamicsFrame, CarIdxFrame, CarInputsFrame, CarStatusFrame, ChassisFrame,
    EnvironmentFrame, LapTimingFrame, SessionFrame,
};
use crate::computations::{
    fuel, lap_delta, lap_delta::LapDeltaState, pit_stops::PitStopsFrame, proximity, standings,
};

/// Shared state for the iRacing telemetry connection.
pub struct TelemetryState {
    pub running: Arc<AtomicBool>,
    pub last_session_info: Arc<Mutex<Option<Arc<SessionInfo>>>>,

    /// Start grid positions keyed by carIdx: (overall_pos, class_pos), 1-indexed.
    pub start_positions: Arc<Mutex<HashMap<i32, (i32, i32)>>>,

    /// Player pit stop counter for the current session.
    pub pit_stop_count: Arc<AtomicU32>,

    /// Whether the player was on pit road on the previous frame.
    pub was_on_pit_road: Arc<AtomicBool>,

    /// Session number tracked for pit stop reset.
    pub pit_tracked_session_num: Arc<AtomicI32>,

    /// Stateful lap delta / sector timing computation.
    pub lap_delta_state: Arc<Mutex<LapDeltaState>>,

    /// User-configured pit warning laps (stored as bits of f32).
    pub pit_warning_laps: Arc<AtomicU32>,
}

#[tauri::command]
pub async fn get_last_session_info(
    state: State<'_, TelemetryState>,
) -> Result<Option<Arc<SessionInfo>>, String> {
    let lock = state
        .last_session_info
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    Ok(lock.clone())
}

#[tauri::command]
pub async fn set_pit_warning_laps(
    state: State<'_, TelemetryState>,
    laps: f32,
) -> Result<(), String> {
    state
        .pit_warning_laps
        .store(laps.to_bits(), Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn start_telemetry_stream(
    app: AppHandle,
    state: State<'_, TelemetryState>,
) -> Result<(), String> {
    state.running.store(false, Ordering::SeqCst);
    sleep(Duration::from_millis(50)).await;

    let running = state.running.clone();
    running.store(true, Ordering::SeqCst);

    let last_session_info = state.last_session_info.clone();
    let start_positions = state.start_positions.clone();
    let pit_stop_count = state.pit_stop_count.clone();
    let was_on_pit_road = state.was_on_pit_road.clone();
    let pit_tracked_session_num = state.pit_tracked_session_num.clone();
    let lap_delta_state = state.lap_delta_state.clone();
    let pit_warning_laps = state.pit_warning_laps.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        loop {
            if !running.load(Ordering::SeqCst) {
                debug!("Stream stopped by user");
                break;
            }

            app_clone.emit("iracing://status", "waiting").ok();
            info!("Waiting for iRacing...");

            let connection = loop {
                if !running.load(Ordering::SeqCst) {
                    return;
                }

                match Pitwall::connect().await {
                    Ok(conn) => break conn,
                    Err(_) => {
                        sleep(Duration::from_secs(3)).await;
                    }
                }
            };

            info!("Connected to iRacing successfully");
            app_clone.emit("iracing://status", "connected").ok();

            let telemetry_stream = connection.subscribe::<AllFieldsFrame>(UpdateRate::Native);
            let session_stream = connection.session_updates();

            debug!("Subscribed to telemetry and session streams");

            let app_session = app_clone.clone();
            let running_session = running.clone();
            let last_session_info_clone = last_session_info.clone();
            let start_positions_clone = start_positions.clone();

            let session_task = tokio::spawn(async move {
                let mut stream = std::pin::pin!(session_stream);

                while let Some(session) = stream.next().await {
                    if !running_session.load(Ordering::SeqCst) {
                        break;
                    }

                    info!(
                        has_driver_info = session.driver_info.is_some(),
                        track = %session.weekend_info.track_display_name,
                        "Session info updated"
                    );

                    // Update start positions from ResultsPositions if available
                    update_start_positions(&session, &start_positions_clone);

                    if let Ok(mut lock) = last_session_info_clone.lock() {
                        *lock = Some(session.clone());
                    }

                    if let Err(e) = app_session.emit("iracing://session-info", &*session) {
                        warn!("Failed to emit session info: {}", e);
                    }
                }

                debug!("Session stream ended");
            });

            let mut stream = std::pin::pin!(telemetry_stream);
            let mut tick: u64 = 0;

            loop {
                if !running.load(Ordering::SeqCst) {
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
                                "First telemetry frame received"
                            );
                        }

                        emit_domain_frames(
                            &app_clone,
                            &frame,
                            tick,
                            &last_session_info,
                            &start_positions,
                            &pit_stop_count,
                            &was_on_pit_road,
                            &pit_tracked_session_num,
                            &lap_delta_state,
                            &pit_warning_laps,
                        );
                    }
                    Ok(None) => {
                        break;
                    }
                    Err(_) => {
                        let is_running = std::process::Command::new("tasklist")
                            .arg("/FI")
                            .arg("IMAGENAME eq iRacingSim64.exe")
                            .output()
                            .map(|o| {
                                String::from_utf8_lossy(&o.stdout).contains("iRacingSim64.exe")
                            })
                            .unwrap_or(false);

                        if !is_running {
                            warn!("iRacingSim64.exe is not running. Disconnecting.");
                            break;
                        } else {
                            debug!("No telemetry for 3s, but process is running. Waiting...");
                            app_clone.emit("iracing://status", "waiting").ok();
                        }
                    }
                }
            }

            session_task.abort();

            info!(tick, "Stream ended, will retry connection...");

            if let Ok(mut lock) = last_session_info.lock() {
                *lock = None;
            }

            // Reset pit stop state on disconnect
            pit_stop_count.store(0, Ordering::Relaxed);
            was_on_pit_road.store(false, Ordering::Relaxed);
            pit_tracked_session_num.store(-1, Ordering::Relaxed);
            if let Ok(mut s) = lap_delta_state.lock() {
                s.reset();
            }

            app_clone.emit("iracing://status", "disconnected").ok();
            app_clone.emit("iracing://disconnected", &()).ok();

            if !running.load(Ordering::SeqCst) {
                break;
            }

            app_clone.emit("iracing://status", "waiting").ok();

            loop {
                if !running.load(Ordering::SeqCst) {
                    break;
                }

                let is_running = std::process::Command::new("tasklist")
                    .arg("/FI")
                    .arg("IMAGENAME eq iRacingSim64.exe")
                    .output()
                    .map(|o| String::from_utf8_lossy(&o.stdout).contains("iRacingSim64.exe"))
                    .unwrap_or(false);

                if is_running {
                    debug!("iRacing process detected, attempting reconnect...");
                    break;
                }

                sleep(Duration::from_secs(3)).await;
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_telemetry_stream(state: State<'_, TelemetryState>) -> Result<(), String> {
    state.running.store(false, Ordering::SeqCst);
    debug!("Telemetry stream stopped");
    Ok(())
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

#[allow(clippy::too_many_arguments)]
fn emit_domain_frames(
    app: &AppHandle,
    frame: &AllFieldsFrame,
    tick: u64,
    last_session_info: &Mutex<Option<Arc<SessionInfo>>>,
    start_positions: &Mutex<HashMap<i32, (i32, i32)>>,
    pit_stop_count: &AtomicU32,
    was_on_pit_road: &AtomicBool,
    pit_tracked_session_num: &AtomicI32,
    lap_delta_state: &Mutex<LapDeltaState>,
    pit_warning_laps_atomic: &AtomicU32,
) {
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

    let needs_computed = tick.is_multiple_of(6) || tick.is_multiple_of(15) || tick == 1;
    let session_snapshot = if needs_computed {
        last_session_info
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    } else {
        None
    };
    let session_info = session_snapshot.as_deref();

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
            let proximity = proximity::compute(frame, session);
            if let Err(e) = app.emit("iracing://computed/proximity", &proximity) {
                warn!("Failed to emit proximity: {}", e);
            }

            let start_pos_snapshot = start_positions
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .clone();
            let standings_frame = standings::compute(frame, session, &start_pos_snapshot, true);
            if let Err(e) = app.emit("iracing://computed/standings", &standings_frame) {
                warn!("Failed to emit standings: {}", e);
            }

            let lap_delta_frame = lap_delta::compute(frame, session, lap_delta_state);
            if let Err(e) = app.emit("iracing://computed/lap-delta", &lap_delta_frame) {
                warn!("Failed to emit lap delta: {}", e);
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
            let pit_warning_laps = f32::from_bits(pit_warning_laps_atomic.load(Ordering::Relaxed));
            if let Some(fuel_frame) =
                fuel::compute(frame, session, frame.session_num, pit_warning_laps)
            {
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
                let tracked_session = pit_tracked_session_num.load(Ordering::Relaxed);

                if current_session_num != tracked_session {
                    pit_tracked_session_num.store(current_session_num, Ordering::Relaxed);
                    pit_stop_count.store(0, Ordering::Relaxed);
                    was_on_pit_road.store(false, Ordering::Relaxed);
                }

                let on_pit = frame
                    .car_idx_on_pit_road
                    .get(player_idx as usize)
                    .copied()
                    .unwrap_or(false);
                let was = was_on_pit_road.load(Ordering::Relaxed);

                if on_pit && !was {
                    pit_stop_count.fetch_add(1, Ordering::Relaxed);
                }
                was_on_pit_road.store(on_pit, Ordering::Relaxed);

                let stops = pit_stop_count.load(Ordering::Relaxed);
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
