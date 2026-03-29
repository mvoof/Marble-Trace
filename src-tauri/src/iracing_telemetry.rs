use crate::telemetry_frame::TelemetryFrame;
use futures::StreamExt;
use pitwall::{Pitwall, UpdateRate};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::time::sleep;
use tracing::{debug, info, warn};

pub struct TelemetryState {
    pub running: Arc<AtomicBool>,
}

#[tauri::command]
pub async fn start_telemetry_stream(
    app: AppHandle,
    state: State<'_, TelemetryState>,
) -> Result<(), String> {
    state.running.store(false, Ordering::SeqCst);
    sleep(Duration::from_millis(50)).await;

    info!("Connecting to iRacing...");

    let connection = Pitwall::connect()
        .await
        .map_err(|e| format!("Failed to connect to iRacing: {}", e))?;
    info!("Connected to iRacing successfully");

    let stream = connection.subscribe::<TelemetryFrame>(UpdateRate::Native);
    debug!("Subscribed to telemetry stream");

    let running = state.running.clone();
    running.store(true, Ordering::SeqCst);

    let app_clone = app.clone();

    tokio::spawn(async move {
        let _connection = connection;
        let mut stream = std::pin::pin!(stream);
        let mut count: u64 = 0;

        debug!("Stream loop started, waiting for frames...");

        while let Some(frame) = stream.next().await {
            if !running.load(Ordering::SeqCst) {
                debug!("Stream stopped by user");
                break;
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

            if let Err(e) = app.emit("telemetry-frame-event", &frame) {
                warn!("Failed to emit frame: {}", e);
                break;
            }
        }

        let was_running = running.swap(false, Ordering::SeqCst);
        info!(count, was_running, "Stream ended");

        if was_running {
            app_clone.emit("telemetry-disconnected-event", &()).ok();
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
