use crate::telemetry_frame::{
    TelemetryDebugEvent, TelemetryDisconnectedEvent, TelemetryFrame, TelemetryFrameEvent,
};
use futures::StreamExt;
use pitwall::UpdateRate;
use pitwall_tauri::Pitwall;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, State};
use tauri_specta::Event;
use tokio::time::sleep;

pub struct TelemetryState {
    pub running: Arc<AtomicBool>,
}

#[tauri::command]
#[specta::specta]
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

        TelemetryDebugEvent("Stream loop started, waiting for first frame...".into())
            .emit(&app_clone)
            .ok();

        eprintln!("[telemetry] Stream loop started, waiting for frames...");

        while let Some(frame) = stream.next().await {
            if !running.load(Ordering::SeqCst) {
                TelemetryDebugEvent("Stream stopped by user".into())
                    .emit(&app_clone)
                    .ok();
                break;
            }

            count += 1;

            if count == 1 {
                let msg = format!(
                    "First frame received! speed={}, rpm={}, gear={}",
                    frame.speed, frame.rpm, frame.gear
                );

                TelemetryDebugEvent(msg.clone()).emit(&app_clone).ok();
                eprintln!("[telemetry] {}", msg);
            }

            if let Err(e) = TelemetryFrameEvent(frame).emit(&app) {
                let msg = format!("Failed to emit frame: {}", e);

                TelemetryDebugEvent(msg.clone()).emit(&app_clone).ok();
                eprintln!("[telemetry] {}", msg);
                break;
            }
        }

        let was_running = running.swap(false, Ordering::SeqCst);
        let msg = format!(
            "Stream ended after {} frames (was_running={})",
            count, was_running
        );

        TelemetryDebugEvent(msg.clone()).emit(&app_clone).ok();
        eprintln!("[telemetry] {}", msg);

        if was_running {
            TelemetryDisconnectedEvent(()).emit(&app_clone).ok();
        }
    });

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn stop_telemetry_stream(state: State<'_, TelemetryState>) -> Result<(), String> {
    state.running.store(false, Ordering::SeqCst);
    eprintln!("Telemetry stream stopped");

    Ok(())
}
