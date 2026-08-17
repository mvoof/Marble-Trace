//! Tauri commands for the remote-widgets server. Thin wrappers: the lifetime
//! of the server lives in `RemoteState`, everything it broadcasts comes from
//! the hub.
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, State};
use tokio::sync::oneshot;
use tracing::{info, warn};

use super::hub::RemoteHub;
use super::server::{local_ip, screen_url, serve, token_of};
use crate::model::remote::{RemoteDevice, RemoteServerConfig, RemoteServerInfo};
use crate::utils::lock_or_recover;

#[derive(Default)]
pub struct RemoteState {
    pub hub: Arc<RemoteHub>,
    /// Present exactly while a server task is running.
    shutdown: Mutex<Option<oneshot::Sender<()>>>,
    /// Resolves when that task has actually returned. Restarting on the same
    /// port has to wait for it: signalling the shutdown only asks the old
    /// listener to stop, and until it has, the address is still taken.
    stopped: Mutex<Option<oneshot::Receiver<()>>>,
}

/// How long a restart waits for the previous listener to release the port.
/// Generous: it only ever costs anything when the server is being restarted,
/// and giving up early turns into a bind error the user has to understand.
const SHUTDOWN_GRACE: std::time::Duration = std::time::Duration::from_secs(3);

impl RemoteState {
    fn info(&self, lan: bool) -> RemoteServerInfo {
        RemoteServerInfo {
            running: self.hub.running.load(Ordering::Relaxed),
            ip: if lan { local_ip() } else { "localhost".into() },
            port: self.hub.port.load(Ordering::Relaxed),
            token: token_of(&self.hub),
            lan,
            client_count: self.hub.client_count() as u32,
        }
    }
}

/// Remembered so `get_remote_server_info` can report the right host without
/// the frontend passing the config back in every time.
static LAN_MODE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[tauri::command]
pub async fn start_remote_server(
    app: AppHandle,
    state: State<'_, RemoteState>,
    config: RemoteServerConfig,
) -> Result<RemoteServerInfo, String> {
    stop_and_wait(&state).await;

    let hub = Arc::clone(&state.hub);

    hub.set_telemetry_hz(config.telemetry_hz);
    *lock_or_recover(&hub.token) = config.token.clone();
    *lock_or_recover(&hub.language) = config.language.clone();

    let (tx, rx) = oneshot::channel();
    let (stopped_tx, stopped_rx) = oneshot::channel();

    // Bind before returning so a port clash surfaces as a command error the
    // settings UI can show, instead of a server that silently never came up.
    let listener_hub = Arc::clone(&hub);
    let (ready_tx, ready_rx) = oneshot::channel::<Result<(), String>>();

    tauri::async_runtime::spawn(async move {
        let result = serve(app, listener_hub, config.port, config.lan, rx).await;

        match result {
            Ok(()) => info!("remote: server stopped"),
            Err(error) => {
                warn!("remote: {}", error);

                let _ = ready_tx.send(Err(error));
                let _ = stopped_tx.send(());

                return;
            }
        }

        let _ = ready_tx.send(Ok(()));
        let _ = stopped_tx.send(());
    });

    // `serve` only reports back early on a bind failure; a healthy server keeps
    // running, so a short wait is enough to tell the two apart.
    let bind_check = tokio::time::timeout(std::time::Duration::from_millis(400), ready_rx).await;

    if let Ok(Ok(Err(error))) = bind_check {
        return Err(error);
    }

    LAN_MODE.store(config.lan, Ordering::Relaxed);
    *lock_or_recover(&state.shutdown) = Some(tx);
    *lock_or_recover(&state.stopped) = Some(stopped_rx);

    Ok(state.info(config.lan))
}

#[tauri::command]
pub async fn stop_remote_server(state: State<'_, RemoteState>) -> Result<(), String> {
    stop_and_wait(&state).await;

    Ok(())
}

#[tauri::command]
pub async fn get_remote_server_info(
    state: State<'_, RemoteState>,
) -> Result<RemoteServerInfo, String> {
    Ok(state.info(LAN_MODE.load(Ordering::Relaxed)))
}

/// What the connected devices report about their own displays. Read by the
/// settings UI to offer matching a screen's size to the real one.
#[tauri::command]
pub async fn get_remote_devices(
    state: State<'_, RemoteState>,
) -> Result<Vec<RemoteDevice>, String> {
    Ok(state.hub.devices())
}

/// The main window pushes one snapshot per remote screen — the widgets of that
/// screen plus whatever app-level settings they read. The backend never parses
/// it; it only caches and forwards.
#[tauri::command]
pub async fn publish_remote_snapshot(
    state: State<'_, RemoteState>,
    slug: String,
    snapshot: serde_json::Value,
) -> Result<(), String> {
    state.hub.publish_snapshot(slug, snapshot);

    Ok(())
}

/// A hotkey pressed in the main window reaches the overlay windows as a Tauri
/// event; this is the same command on its way to a browser instead.
#[tauri::command]
pub async fn publish_remote_control(
    state: State<'_, RemoteState>,
    kind: String,
    data: serde_json::Value,
) -> Result<(), String> {
    state.hub.publish_control(&kind, data);

    Ok(())
}

#[tauri::command]
pub async fn remote_screen_url(
    state: State<'_, RemoteState>,
    slug: String,
) -> Result<String, String> {
    let lan = LAN_MODE.load(Ordering::Relaxed);
    let ip = if lan { local_ip() } else { "localhost".into() };

    Ok(screen_url(
        &ip,
        state.hub.port.load(Ordering::Relaxed),
        &slug,
        &token_of(&state.hub),
    ))
}

/// Asks a running server to stop and waits until it has, so the caller can bind
/// the same port again.
async fn stop_and_wait(state: &State<'_, RemoteState>) {
    let signal = lock_or_recover(&state.shutdown).take();
    let stopped = lock_or_recover(&state.stopped).take();

    let Some(signal) = signal else {
        return;
    };

    let _ = signal.send(());

    let Some(stopped) = stopped else {
        return;
    };

    if tokio::time::timeout(SHUTDOWN_GRACE, stopped).await.is_err() {
        warn!("remote: previous server did not stop within the grace period");
    }
}
