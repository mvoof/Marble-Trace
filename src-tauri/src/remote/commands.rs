//! Tauri commands for the remote-widgets server. Thin wrappers: the lifetime
//! of the server lives in `RemoteState`, everything it broadcasts comes from
//! the hub.
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, State};
use tokio::sync::oneshot;
use tracing::{info, warn};

use super::hub::RemoteHub;
use super::server::{bind, local_ip, screen_url, serve, token_of};
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

/// A port released by a listener that has only just been asked to stop is not
/// free the instant the request returns, so a restart takes the address a few
/// times before calling it occupied. Long enough to outlast a graceful
/// shutdown, short enough that a genuinely taken port is reported quickly.
const BIND_ATTEMPTS: u32 = 12;
const BIND_RETRY_DELAY: std::time::Duration = std::time::Duration::from_millis(150);

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

    // Bound here rather than inside the spawned task, so a port clash is a
    // value the settings UI can show instead of a server that silently never
    // came up — and so a failure leaves nothing half-started behind.
    let listener = bind_with_retry(config.port, config.lan).await?;

    let bound = listener
        .local_addr()
        .map(|value| value.port())
        .unwrap_or(config.port);

    let generation = hub.generation.fetch_add(1, Ordering::Relaxed) + 1;

    hub.port.store(bound, Ordering::Relaxed);
    hub.running.store(true, Ordering::Relaxed);

    let (tx, rx) = oneshot::channel();
    let (stopped_tx, stopped_rx) = oneshot::channel();

    let server_hub = Arc::clone(&hub);

    tauri::async_runtime::spawn(async move {
        match serve(app, server_hub, listener, config.lan, generation, rx).await {
            Ok(()) => info!("remote: server stopped"),
            Err(error) => warn!("remote: {}", error),
        }

        let _ = stopped_tx.send(());
    });

    LAN_MODE.store(config.lan, Ordering::Relaxed);
    *lock_or_recover(&state.shutdown) = Some(tx);
    *lock_or_recover(&state.stopped) = Some(stopped_rx);

    Ok(state.info(config.lan))
}

async fn bind_with_retry(port: u16, lan: bool) -> Result<tokio::net::TcpListener, String> {
    let mut last = String::new();

    for attempt in 0..BIND_ATTEMPTS {
        match bind(port, lan).await {
            Ok(listener) => return Ok(listener),
            Err(error) => {
                last = error;

                if attempt + 1 < BIND_ATTEMPTS {
                    tokio::time::sleep(BIND_RETRY_DELAY).await;
                }
            }
        }
    }

    warn!("remote: {}", last);

    Err(last)
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

    if let Some(signal) = signal {
        let _ = signal.send(());
    }

    let Some(mut stopped) = stopped else {
        return;
    };

    if tokio::time::timeout(SHUTDOWN_GRACE, &mut stopped)
        .await
        .is_err()
    {
        warn!("remote: previous server did not stop within the grace period");

        // Put the handle back rather than dropping it: that task is still
        // alive and still holds the port, and this receiver is the only thing
        // left that can wait for it. Dropped here, every later start binds
        // against a listener nothing can stop or even see.
        *lock_or_recover(&state.stopped) = Some(stopped);
    }
}
