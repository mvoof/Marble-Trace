/// iRacing telemetry service — connection management and data streaming.
///
/// Manages the lifecycle of the iRacing telemetry connection:
/// - Connects to iRacing via pitwall `LiveConnection`
/// - Reads ALL telemetry variables in a single `AllFieldsFrame` per tick
/// - Decomposes into domain-specific frames and emits as separate Tauri events
/// - Handles session info updates (YAML) via a separate stream
/// - Auto-reconnects on disconnect
///
/// Tauri events emitted:
/// - `iracing://telemetry/car-dynamics` — CarDynamicsFrame (60Hz)
/// - `iracing://telemetry/car-inputs` — CarInputsFrame (60Hz)
/// - `iracing://telemetry/car-status` — CarStatusFrame (60Hz)
/// - `iracing://telemetry/lap-timing` — LapTimingFrame (60Hz)
/// - `iracing://telemetry/session` — SessionFrame (60Hz)
/// - `iracing://telemetry/environment` — EnvironmentFrame (60Hz)
/// - `iracing://session-info` — pitwall SessionInfo (on YAML change)
/// - `iracing://status` — connection status string
/// - `iracing://disconnected` — disconnect signal
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures::StreamExt;
use pitwall::{Pitwall, SessionInfo, UpdateRate};
use tauri::{AppHandle, Emitter, State};
use tokio::time::sleep;
use tracing::{debug, info, warn};

use super::frames::{
    AllFieldsFrame, CarDynamicsFrame, CarIdxFrame, CarInputsFrame,
    CarStatusFrame, EnvironmentFrame, LapTimingFrame, SessionFrame,
};

/// Shared state for the iRacing telemetry connection.
pub struct TelemetryState {
    /// Whether the telemetry stream is currently running
    pub running: Arc<AtomicBool>,

    /// Last received session info (YAML), cached for on-demand access
    pub last_session_info: Arc<Mutex<Option<Arc<SessionInfo>>>>,
}

/// Returns the last cached session info (driver info, weekend info, etc.)
///
/// This is the YAML session data parsed by pitwall, containing driver car
/// parameters (RPM limits, fuel capacity), weekend/track info, and driver list.
///
/// @see https://sajax.github.io/irsdkdocs/yaml/
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

/// Starts the telemetry stream — connects to iRacing and begins emitting events.
///
/// Spawns a background tokio task that:
/// 1. Connects to iRacing via pitwall (auto-retries every 3s)
/// 2. Subscribes to telemetry frames at native update rate
/// 3. Subscribes to session YAML updates
/// 4. Emits domain-specific events on each frame tick
/// 5. Auto-reconnects on disconnect
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

            let telemetry_stream =
                connection.subscribe::<AllFieldsFrame>(UpdateRate::Native);
            let session_stream = connection.session_updates();

            debug!("Subscribed to telemetry and session streams");

            // Session info stream task
            let app_session = app_clone.clone();
            let running_session = running.clone();
            let last_session_info_clone = last_session_info.clone();

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

                    // Cache for on-demand access
                    if let Ok(mut lock) = last_session_info_clone.lock() {
                        *lock = Some(session.clone());
                    }

                    // Emit full session info to frontend
                    if let Err(e) =
                        app_session.emit("iracing://session-info", &*session)
                    {
                        warn!("Failed to emit session info: {}", e);
                    }
                }

                debug!("Session stream ended");
            });

            // Telemetry frame stream — main loop
            let mut stream = std::pin::pin!(telemetry_stream);
            let mut count: u64 = 0;

            loop {
                if !running.load(Ordering::SeqCst) {
                    debug!("Stream stopped by user");
                    return;
                }

                match tokio::time::timeout(Duration::from_secs(3), stream.next()).await {
                    Ok(Some(frame)) => {
                        count += 1;

                        if count == 1 {
                            info!(
                                speed = frame.speed,
                                rpm = frame.rpm,
                                gear = frame.gear,
                                "First telemetry frame received"
                            );
                        }

                        // Decompose AllFieldsFrame into domain frames and emit each
                        emit_domain_frames(&app_clone, &frame);
                    }
                    Ok(None) => {
                        // Stream ended
                        break;
                    }
                    Err(_) => {
                        // Timeout (no frames for 3s)
                        // Check if the process is actually gone
                        let is_running = std::process::Command::new("tasklist")
                            .arg("/FI")
                            .arg("IMAGENAME eq iRacingSim64.exe")
                            .output()
                            .map(|o| String::from_utf8_lossy(&o.stdout).contains("iRacingSim64.exe"))
                            .unwrap_or(false);

                        if !is_running {
                            warn!("iRacingSim64.exe is not running. Disconnecting.");
                            break;
                        } else {
                            debug!("No telemetry for 3s, but process is running. Waiting...");
                            app_clone.emit("iracing://status", "waiting").ok();
                            // Do not break, let the loop continue and wait for the next frame
                        }
                    }
                }
            }

            // Important: Abort the session task so it releases its connection handles.
            // If handles are kept alive, the OS won't clean up the shared memory,
            // and the next `connect()` will falsely succeed.
            session_task.abort();

            info!(count, "Stream ended, will retry connection...");

            // Clear cached session info on disconnect
            if let Ok(mut lock) = last_session_info.lock() {
                *lock = None;
            }

            app_clone.emit("iracing://status", "disconnected").ok();
            app_clone.emit("iracing://disconnected", &()).ok();

            if !running.load(Ordering::SeqCst) {
                break;
            }

            // Wait for iRacing process before attempting reconnect
            app_clone.emit("iracing://status", "waiting").ok();

            loop {
                if !running.load(Ordering::SeqCst) {
                    break;
                }

                let is_running = std::process::Command::new("tasklist")
                    .arg("/FI")
                    .arg("IMAGENAME eq iRacingSim64.exe")
                    .output()
                    .map(|o| {
                        String::from_utf8_lossy(&o.stdout)
                            .contains("iRacingSim64.exe")
                    })
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

/// Stops the telemetry stream.
#[tauri::command]
pub async fn stop_telemetry_stream(
    state: State<'_, TelemetryState>,
) -> Result<(), String> {
    state.running.store(false, Ordering::SeqCst);
    debug!("Telemetry stream stopped");

    Ok(())
}

/// Decomposes an `AllFieldsFrame` into domain-specific frames
/// and emits each as a separate Tauri event.
fn emit_domain_frames(app: &AppHandle, frame: &AllFieldsFrame) {
    let car_dynamics = CarDynamicsFrame::from(frame);
    let car_idx = CarIdxFrame::from(frame);
    let car_inputs = CarInputsFrame::from(frame);
    let car_status = CarStatusFrame::from(frame);
    let lap_timing = LapTimingFrame::from(frame);
    let session = SessionFrame::from(frame);
    let environment = EnvironmentFrame::from(frame);

    if let Err(e) =
        app.emit("iracing://telemetry/car-dynamics", &car_dynamics)
    {
        warn!("Failed to emit car dynamics: {}", e);
    }

    if let Err(e) = app.emit("iracing://telemetry/car-idx", &car_idx) {
        warn!("Failed to emit car idx: {}", e);
    }

    if let Err(e) = app.emit("iracing://telemetry/car-inputs", &car_inputs) {
        warn!("Failed to emit car inputs: {}", e);
    }

    if let Err(e) = app.emit("iracing://telemetry/car-status", &car_status) {
        warn!("Failed to emit car status: {}", e);
    }

    if let Err(e) = app.emit("iracing://telemetry/lap-timing", &lap_timing) {
        warn!("Failed to emit lap timing: {}", e);
    }

    if let Err(e) = app.emit("iracing://telemetry/session", &session) {
        warn!("Failed to emit session: {}", e);
    }

    if let Err(e) =
        app.emit("iracing://telemetry/environment", &environment)
    {
        warn!("Failed to emit environment: {}", e);
    }
}
