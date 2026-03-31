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

    let running = state.running.clone();
    running.store(true, Ordering::SeqCst);

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

            let stream = connection.subscribe::<TelemetryFrame>(UpdateRate::Native);
            debug!("Subscribed to telemetry stream");

            let mut stream = std::pin::pin!(stream);
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
            app_clone
                .emit("telemetry-status-event", "disconnected")
                .ok();
            app_clone.emit("telemetry-disconnected-event", &()).ok();

            if !running.load(Ordering::SeqCst) {
                break;
            }

            sleep(Duration::from_secs(2)).await;
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
