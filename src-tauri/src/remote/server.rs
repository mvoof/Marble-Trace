//! HTTP + WebSocket server that serves the overlay bundle to devices on the
//! LAN.
//!
//! The page a browser gets is the same frontend build the overlay windows run;
//! only the transport differs. Assets come from the Tauri asset resolver in a
//! packaged build and are proxied to the Vite dev server in development, so
//! `npm run tauri:dev` serves a remote screen without a separate build step.
use std::net::{Ipv4Addr, SocketAddr};
use std::sync::atomic::Ordering;
use std::sync::Arc;

use axum::extract::ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, Path, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use futures::{SinkExt, StreamExt};
use serde::Deserialize;
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio::sync::broadcast::error::RecvError;
use tracing::{info, warn};

use super::hub::RemoteHub;
use super::pages::{index_page, unauthorized_page};
use crate::model::remote::RemoteDevice;
use crate::utils::lock_or_recover;

/// The page every remote screen loads. A separate entry from `index.html`: it
/// pulls no Tauri API, so it also runs in a plain browser.
const REMOTE_ENTRY: &str = "remote.html";

/// Carries a `RemoteDevice` to the main window whenever one connects,
/// disconnects or reports a new viewport.
pub const EVENT_REMOTE_DEVICE: &str = "remote://device";

/// Policy violation — the close code the remote page reads as "wrong token".
const CLOSE_UNAUTHORIZED: u16 = 1008;

/// Where the Vite dev server lives while `tauri:dev` runs.
const DEV_ORIGIN: &str = "http://localhost:1420";

#[derive(Clone)]
struct ServerState {
    app: AppHandle,
    hub: Arc<RemoteHub>,
    dev: bool,
}

/// The only thing a client may send: what its own display looks like. It is
/// recorded and shown in settings, and never applied to anything on its own —
/// remote screens stay read-only.
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum ClientMessage {
    // `rename_all` above renames the variants, not their fields — the payload
    // is camelCase on the wire, so the fields need their own rule.
    #[serde(rename_all = "camelCase")]
    Hello {
        #[serde(default)]
        viewport_width: u32,
        #[serde(default)]
        viewport_height: u32,
        #[serde(default)]
        screen_width: u32,
        #[serde(default)]
        screen_height: u32,
        #[serde(default)]
        pixel_ratio: f32,
        #[serde(default)]
        standalone: bool,
    },
}

#[derive(Deserialize)]
struct AuthQuery {
    #[serde(default, alias = "t")]
    token: Option<String>,
    #[serde(default)]
    screen: Option<String>,
}

/// Best-effort LAN address, for the URL shown in settings. Loopback means the
/// machine has no usable network interface, and the URL is only good on the
/// host itself.
pub fn local_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| Ipv4Addr::LOCALHOST.to_string())
}

/// Binds the server and runs it until `shutdown` resolves.
///
/// `lan` decides the bind address: with it off the server is reachable from the
/// host only, which is the safe default for a machine on an untrusted network.
pub async fn serve(
    app: AppHandle,
    hub: Arc<RemoteHub>,
    port: u16,
    lan: bool,
    shutdown: tokio::sync::oneshot::Receiver<()>,
) -> Result<(), String> {
    let host = if lan {
        Ipv4Addr::UNSPECIFIED
    } else {
        Ipv4Addr::LOCALHOST
    };

    let addr = SocketAddr::from((host, port));

    let listener = TcpListener::bind(addr)
        .await
        .map_err(|error| format!("failed to bind {addr}: {error}"))?;

    let bound = listener
        .local_addr()
        .map(|value| value.port())
        .unwrap_or(port);

    hub.port.store(bound, Ordering::Relaxed);
    hub.running.store(true, Ordering::Relaxed);

    let dev = cfg!(debug_assertions);

    let state = ServerState {
        app,
        hub: Arc::clone(&hub),
        dev,
    };

    let router = Router::new()
        .route("/", get(index))
        .route("/health", get(health))
        .route("/ws", get(websocket))
        .route("/r/{slug}", get(remote_page))
        .fallback(get(asset))
        .with_state(state);

    info!("remote: listening on {} (lan={})", addr, lan);

    let result = axum::serve(
        listener,
        // Connect info, so a request can be told apart by where it came from:
        // the machine running the app needs no token.
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(async {
        let _ = shutdown.await;
    })
    .await
    .map_err(|error| format!("remote server stopped: {error}"));

    hub.running.store(false, Ordering::Relaxed);
    hub.port.store(0, Ordering::Relaxed);
    hub.clear();

    result
}

async fn health() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

/// Landing page listing the screens this server serves.
///
/// Behind the same token as everything else: without it the page says so and
/// lists nothing, so the screen names are not handed to whoever probes the port.
async fn index(
    State(state): State<ServerState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Query(query): Query<AuthQuery>,
) -> Response {
    let language = language_of(&state.hub);

    if !authorized(&state, &peer, query.token.as_deref()) {
        return unauthorized_page(&language, "/");
    }

    index_page(
        &state.hub.screens(),
        &query.token.unwrap_or_default(),
        &language,
    )
}

/// Serves the remote entry for `/r/<slug>`. The slug itself is read by the
/// page from its own URL — the server does not need to template anything in.
async fn remote_page(
    State(state): State<ServerState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Path(slug): Path<String>,
    Query(query): Query<AuthQuery>,
) -> Response {
    if !authorized(&state, &peer, query.token.as_deref()) {
        return unauthorized_page(&language_of(&state.hub), &format!("/r/{slug}"));
    }

    if slug.is_empty() {
        return (StatusCode::NOT_FOUND, "unknown screen").into_response();
    }

    serve_asset(&state, REMOTE_ENTRY).await
}

/// Everything that is not a route is a bundle asset. Requests coming from
/// `/r/<slug>` are relative to that directory, so the leading segment is
/// stripped before the lookup.
async fn asset(State(state): State<ServerState>, uri: axum::http::Uri) -> Response {
    let path = uri.path().trim_start_matches('/');

    let path = match path.strip_prefix("r/") {
        Some(rest) => rest.split_once('/').map(|(_, tail)| tail).unwrap_or(rest),
        None => path,
    };

    if path.is_empty() {
        return (StatusCode::NOT_FOUND, "no screen selected").into_response();
    }

    // The query travels with the path: in development Vite serves a JSON file
    // as a raw document, and the very same file as an ES module only when asked
    // with `?import`. Dropping it hands the browser JSON where it expects a
    // module.
    serve_asset_with_query(&state, path, uri.query()).await
}

async fn serve_asset(state: &ServerState, path: &str) -> Response {
    serve_asset_with_query(state, path, None).await
}

async fn serve_asset_with_query(state: &ServerState, path: &str, query: Option<&str>) -> Response {
    if state.dev {
        return proxy_dev_asset(path, query).await;
    }

    // The embedded bundle is keyed by path alone, so the query is dropped here.
    let Some(asset) = state.app.asset_resolver().get(path.to_string()) else {
        return (StatusCode::NOT_FOUND, "asset not found").into_response();
    };

    let mut headers = HeaderMap::new();

    if let Ok(value) = asset.mime_type.parse() {
        headers.insert(header::CONTENT_TYPE, value);
    }

    (StatusCode::OK, headers, asset.bytes).into_response()
}

/// In development the bundle is not embedded, so the request is forwarded to
/// Vite. Only ever reached in a debug build.
async fn proxy_dev_asset(path: &str, query: Option<&str>) -> Response {
    let url = match query {
        Some(query) => format!("{DEV_ORIGIN}/{path}?{query}"),
        None => format!("{DEV_ORIGIN}/{path}"),
    };

    match reqwest::get(&url).await {
        Ok(upstream) => {
            let status =
                StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);

            let mime = upstream
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .unwrap_or("application/octet-stream")
                .to_string();

            match upstream.bytes().await {
                Ok(body) => {
                    let mut headers = HeaderMap::new();

                    if let Ok(value) = mime.parse() {
                        headers.insert(header::CONTENT_TYPE, value);
                    }

                    (status, headers, body).into_response()
                }
                Err(error) => {
                    (StatusCode::BAD_GATEWAY, format!("dev proxy: {error}")).into_response()
                }
            }
        }
        Err(error) => (
            StatusCode::BAD_GATEWAY,
            format!("dev server unreachable at {DEV_ORIGIN}: {error}"),
        )
            .into_response(),
    }
}

async fn websocket(
    State(state): State<ServerState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Query(query): Query<AuthQuery>,
    upgrade: WebSocketUpgrade,
) -> Response {
    // A browser cannot read the status of a failed upgrade — it only ever sees
    // close code 1006 and retries forever. Completing the handshake just to
    // close with 1008 is the one way to tell the page its token is wrong.
    if !authorized(&state, &peer, query.token.as_deref()) {
        return upgrade.on_upgrade(|mut socket| async move {
            let _ = socket
                .send(Message::Close(Some(CloseFrame {
                    code: CLOSE_UNAUTHORIZED,
                    reason: "invalid token".into(),
                })))
                .await;
        });
    }

    let screen = query.screen.unwrap_or_default();

    upgrade.on_upgrade(move |socket| client_loop(socket, state.app, state.hub, screen))
}

/// One connected browser. Reads nothing but keepalives: the remote screens are
/// read-only by protocol, so a compromised client on the network cannot write
/// into the user's settings.
async fn client_loop(socket: WebSocket, app: AppHandle, hub: Arc<RemoteHub>, screen: String) {
    let (mut sink, mut stream) = socket.split();
    let mut rx = hub.subscribe();

    if let Some(snapshot) = hub.snapshot_for(&screen) {
        if let Some(message) = RemoteHub::encode("snapshot", snapshot) {
            if sink
                .send(Message::Text(message.as_str().into()))
                .await
                .is_err()
            {
                return;
            }
        }
    }

    for message in hub.replay_messages() {
        if sink
            .send(Message::Text(message.as_str().into()))
            .await
            .is_err()
        {
            return;
        }
    }

    info!(
        "remote: client connected for screen '{}' ({} total)",
        screen,
        hub.client_count()
    );

    loop {
        tokio::select! {
            incoming = stream.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        record_client_message(&app, &hub, &screen, text.as_str());
                    }
                    // Any other frame is ignored by design; only the close
                    // frame ends the loop.
                    Some(Ok(_)) => continue,
                    _ => break,
                }
            }
            broadcast = rx.recv() => {
                match broadcast {
                    Ok(message) => {
                        if sink.send(Message::Text(message.as_str().into())).await.is_err() {
                            break;
                        }
                    }
                    // The client could not keep up. Dropping it is right: it
                    // reconnects and starts from a fresh snapshot rather than
                    // painting a backlog of stale frames.
                    Err(RecvError::Lagged(skipped)) => {
                        warn!("remote: client lagged {} frames, dropping", skipped);

                        break;
                    }
                    Err(RecvError::Closed) => break,
                }
            }
        }
    }

    hub.mark_device_disconnected(&screen);

    if let Some(device) = hub.device_for(&screen) {
        emit_device(&app, device);
    }

    info!("remote: client for screen '{}' disconnected", screen);
}

/// Parses the one message a client is allowed to send. Anything else is
/// dropped without a word: a malformed frame from a device on the network must
/// not be able to disturb the server.
fn record_client_message(app: &AppHandle, hub: &RemoteHub, screen: &str, text: &str) {
    let Ok(ClientMessage::Hello {
        viewport_width,
        viewport_height,
        screen_width,
        screen_height,
        pixel_ratio,
        standalone,
    }) = serde_json::from_str::<ClientMessage>(text)
    else {
        return;
    };

    let device = RemoteDevice {
        slug: screen.to_string(),
        viewport_width,
        viewport_height,
        screen_width,
        screen_height,
        pixel_ratio,
        standalone,
        connected: true,
    };

    hub.set_device(device.clone());
    emit_device(app, device);
}

/// Tells the main window a device reported itself, so the settings UI reflects
/// it without polling and a brand-new screen can be fitted to it once.
fn emit_device(app: &AppHandle, device: RemoteDevice) {
    if let Err(error) = app.emit(EVENT_REMOTE_DEVICE, device) {
        warn!("remote: failed to emit device event: {}", error);
    }
}

/// The URL a user types on the tablet, shown in settings next to the QR code.
pub fn screen_url(ip: &str, port: u16, slug: &str, token: &str) -> String {
    if token.is_empty() {
        format!("http://{ip}:{port}/r/{slug}")
    } else {
        format!("http://{ip}:{port}/r/{slug}?t={token}")
    }
}

/// Reads the token without exposing the mutex to callers.
pub fn token_of(hub: &RemoteHub) -> String {
    lock_or_recover(&hub.token).clone()
}

/// Whether a request may proceed.
///
/// A request from this very machine never needs a token: the app is running
/// here, the token is printed here, and the settings file is right there on
/// disk — asking for it protects nothing and only makes `localhost:8787`
/// useless. It also lets an OBS browser source use a plain address. TCP will
/// not let a machine elsewhere claim a loopback peer address, so this cannot be
/// reached from the network.
fn authorized(state: &ServerState, peer: &SocketAddr, token: Option<&str>) -> bool {
    peer.ip().is_loopback() || state.hub.accepts(token)
}

fn language_of(hub: &RemoteHub) -> String {
    lock_or_recover(&hub.language).clone()
}
