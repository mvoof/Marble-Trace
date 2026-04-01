use crate::telemetry_frame::TelemetryFrame;
use futures::StreamExt;
use pitwall::{Pitwall, UpdateRate};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::time::sleep;
use tracing::{debug, info, warn};

pub struct TelemetryState {
    pub running: Arc<AtomicBool>,
    pub last_driver_info: Arc<Mutex<Option<serde_json::Value>>>,
}

#[tauri::command]
pub async fn get_last_driver_info(
    state: State<'_, TelemetryState>,
) -> Result<Option<serde_json::Value>, String> {
    let lock = state
        .last_driver_info
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    Ok(lock.clone())
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

    let last_driver_info = state.last_driver_info.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        loop {
            if !running.load(Ordering::SeqCst) {
                debug!("Stream stopped by user");
                break;
            }

            app_clone.emit("telemetry-status-event", "waiting").ok();
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
            app_clone.emit("telemetry-status-event", "connected").ok();

            let telemetry_stream = connection.subscribe::<TelemetryFrame>(UpdateRate::Native);
            let session_stream = connection.session_updates();

            debug!("Subscribed to telemetry and session streams");

            let app_session = app_clone.clone();
            let running_session = running.clone();
            let last_driver_info_session = last_driver_info.clone();

            tokio::spawn(async move {
                let mut stream = std::pin::pin!(session_stream);

                while let Some(session) = stream.next().await {
                    if !running_session.load(Ordering::SeqCst) {
                        break;
                    }

                    if let Some(driver_info) = &session.driver_info {
                        info!(
                            red_line = ?driver_info.driver_car_red_line,
                            shift_rpm = ?driver_info.driver_car_sl_shift_rpm,
                            blink_rpm = ?driver_info.driver_car_sl_blink_rpm,
                            idle_rpm = ?driver_info.driver_car_idle_rpm,
                            "Session driver info received"
                        );

                        // Store as JSON value to avoid type import issues
                        if let Ok(val) = serde_json::to_value(driver_info) {
                            if let Ok(mut lock) = last_driver_info_session.lock() {
                                *lock = Some(val);
                            }
                        }

                        if let Err(e) = app_session.emit("session-driver-info-event", &driver_info)
                        {
                            warn!("Failed to emit session driver info: {}", e);
                        }
                    }
                }

                debug!("Session stream ended");
            });

            let mut stream = std::pin::pin!(telemetry_stream);
            let mut count: u64 = 0;

            while let Some(frame) = stream.next().await {
                if !running.load(Ordering::SeqCst) {
                    debug!("Stream stopped by user");
                    return;
                }

                count += 1;

                if count == 1 {
                    info!(
                        speed = frame.speed,
                        rpm = frame.rpm,
                        gear = frame.gear,
                        "First frame received"
                    );
                }

                if let Err(e) = app_clone.emit("telemetry-frame-event", &frame) {
                    warn!("Failed to emit frame: {}", e);
                    break;
                }
            }

            info!(count, "Stream ended, will retry connection...");

            // Clear last driver info on disconnect
            if let Ok(mut lock) = last_driver_info.lock() {
                *lock = None;
            }

            app_clone
                .emit("telemetry-status-event", "disconnected")
                .ok();
            app_clone.emit("telemetry-disconnected-event", &()).ok();

            if !running.load(Ordering::SeqCst) {
                break;
            }

            sleep(Duration::from_secs(1)).await;
            app_clone.emit("telemetry-status-event", "waiting").ok();
            sleep(Duration::from_secs(1)).await;
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
