use crate::telemetry_frame::TelemetryFrame;
use futures::StreamExt;
use pitwall::{Pitwall, UpdateRate};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::time::sleep;

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

    eprintln!("[telemetry] Connecting to iRacing...");

    let connection = Pitwall::connect()
        .await
        .map_err(|e| format!("Failed to connect to iRacing: {}", e))?;
    eprintln!("[telemetry] Connected to iRacing successfully");

    let stream = connection.subscribe::<TelemetryFrame>(UpdateRate::Native);
    eprintln!("[telemetry] Subscribed to telemetry stream");

    let running = state.running.clone();
    running.store(true, Ordering::SeqCst);

    let app_clone = app.clone();

    tokio::spawn(async move {
        let _connection = connection;
        let mut stream = std::pin::pin!(stream);
        let mut count: u64 = 0;

        app_clone
            .emit(
                "telemetry-debug-event",
                "Stream loop started, waiting for first frame...",
            )
            .ok();

        eprintln!("[telemetry] Stream loop started, waiting for frames...");

        while let Some(frame) = stream.next().await {
            if !running.load(Ordering::SeqCst) {
                app_clone
                    .emit("telemetry-debug-event", "Stream stopped by user")
                    .ok();
                break;
            }

            count += 1;

            if count == 1 {
                let msg = format!(
                    "First frame received! speed={}, rpm={}, gear={}",
                    frame.speed, frame.rpm, frame.gear
                );

                app_clone.emit("telemetry-debug-event", &msg).ok();
                eprintln!("[telemetry] {}", msg);
            }

            if let Err(e) = app.emit("telemetry-frame-event", &frame) {
                let msg = format!("Failed to emit frame: {}", e);

                app_clone.emit("telemetry-debug-event", &msg).ok();
                eprintln!("[telemetry] {}", msg);
                break;
            }
        }

        let was_running = running.swap(false, Ordering::SeqCst);
        let msg = format!(
            "Stream ended after {} frames (was_running={})",
            count, was_running
        );

        app_clone.emit("telemetry-debug-event", &msg).ok();
        eprintln!("[telemetry] {}", msg);

        if was_running {
            app_clone.emit("telemetry-disconnected-event", &()).ok();
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn stop_telemetry_stream(state: State<'_, TelemetryState>) -> Result<(), String> {
    state.running.store(false, Ordering::SeqCst);
    eprintln!("Telemetry stream stopped");

    Ok(())
}
