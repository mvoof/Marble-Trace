/// Telemetry thread lifecycle: connect, main loop, reconnect, state reset.
///
/// Runs on a dedicated OS thread — kerb's `IRsdkConnection` is `!Send`
/// (RefCell + raw shared-memory pointers). All kerb usage is encapsulated
/// inside `IracingSource`.
use std::sync::atomic::Ordering;
use std::sync::mpsc::Receiver;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager};

use crate::utils::lock_or_recover;
use tracing::{debug, info, warn};

use super::control::{TelemetryCommand, TelemetryRun};
use super::emitter::{
    emit_domain_frames, EmitContext, EVENT_CAPABILITIES, EVENT_DISCONNECTED, EVENT_SESSION_INFO,
    EVENT_STATUS, EVENT_TRACK_SHAPE, EVENT_WEATHER_FORECAST,
};
use super::io_worker::{IoWorker, SessionUpdate};
use super::loop_state::LoopState;
use super::scheduler::EmitScheduler;
use super::state::TelemetryServiceState;
use crate::computations::ProcessorCommand;
use crate::model::capabilities::CapabilitiesPayload;
use crate::model::enums::{SimStatus, SimType};
use crate::model::track_shape::TrackShapePayload;
use crate::sources::create_source;
use crate::sources::source::{SourceReadResult, TelemetrySource};

const CONNECT_RETRY_DELAY: Duration = Duration::from_secs(1);
/// How long a single `wait_for_data` call blocks before we re-check state.
const WAIT_FOR_DATA_TIMEOUT_MS: u32 = 1000;
/// Consecutive wait timeouts before emitting the "waiting" status (~3s).
const MISSED_WAITS_BEFORE_WAITING_STATUS: u32 = 3;
/// Check the session version counter every N frames (~0.5s at 60 Hz).
const SESSION_POLL_TICKS: u64 = 30;
/// Spawn the dedicated telemetry thread; returns an error if the OS refuses.
pub fn spawn_telemetry_thread(
    app: AppHandle,
    service: Arc<TelemetryServiceState>,
    run: TelemetryRun,
) -> Result<(), String> {
    let spawn_result = std::thread::Builder::new()
        .name("telemetry-runtime".into())
        .spawn(move || {
            info!("Telemetry thread started");

            let TelemetryRun {
                id: run,
                commands,
                config,
            } = run;
            let mut state = LoopState::new(config);

            loop {
                if !service.is_current(run) {
                    info!("Telemetry thread stopping (service not running)");
                    break;
                }

                app.emit(
                    EVENT_STATUS,
                    &SimStatus {
                        status: "waiting".into(),
                        sim: None,
                        replay: None,
                    },
                )
                .ok();
                info!("Waiting for telemetry connection...");

                let Some(mut source) = wait_for_connection(&service, run) else {
                    return;
                };

                let capabilities = source.capabilities();
                let caps_payload = CapabilitiesPayload::from(capabilities);

                info!("Connected to {:?} shared memory", source.sim_type());

                if let Err(e) = app.emit(EVENT_CAPABILITIES, &caps_payload) {
                    warn!("Failed to emit capabilities: {e}");
                }

                let session = LoopSession {
                    run,
                    commands: &commands,
                    capabilities,
                };

                run_telemetry_loop(&app, source.as_mut(), &service, &mut state, session);

                if service.is_superseded(run) {
                    info!("Telemetry thread stopping (a newer run took over)");
                    break;
                }

                info!("Telemetry loop ended, will retry connection...");
                reset_telemetry_state(&app, &service, &mut state);

                if !service.is_current(run) {
                    break;
                }

                // The shared-memory handle can open successfully while iRacing is
                // only sitting in the lobby (not actually broadcasting), so the
                // loop above returns immediately without ever reading a frame.
                // Without this delay, that produces a tight reconnect spin that
                // floods the logs — wait_for_connection only backs off when
                // `create_source` itself fails, which doesn't happen here.
                std::thread::sleep(CONNECT_RETRY_DELAY);
            }
        });

    spawn_result
        .map(|_| ())
        .map_err(|e| format!("Failed to spawn telemetry thread: {e}"))
}

fn wait_for_connection(
    service: &TelemetryServiceState,
    run: u64,
) -> Option<Box<dyn TelemetrySource>> {
    loop {
        if !service.is_current(run) {
            return None;
        }

        if let Some(src) = create_source(SimType::IRacing) {
            return Some(src);
        }

        std::thread::sleep(CONNECT_RETRY_DELAY);
    }
}

/// What one connection's loop runs with besides the state it carries over.
struct LoopSession<'a> {
    run: u64,
    commands: &'a Receiver<TelemetryCommand>,
    capabilities: crate::capabilities::Capabilities,
}

fn run_telemetry_loop(
    app: &AppHandle,
    source: &mut dyn TelemetrySource,
    service: &TelemetryServiceState,
    state: &mut LoopState,
    session: LoopSession<'_>,
) {
    let mut tick: u64 = 0;
    let mut is_waiting = false;
    let mut missed_waits: u32 = 0;
    let mut scheduler = EmitScheduler::new();
    let io = spawn_io_worker(app, source);

    loop {
        if !service.is_current(session.run) {
            debug!("Stream stopped by user");

            return;
        }

        let frame = match source.read_frame(WAIT_FOR_DATA_TIMEOUT_MS) {
            SourceReadResult::Frame(f) => f,
            SourceReadResult::NotReady => {
                missed_waits += 1;

                if missed_waits >= MISSED_WAITS_BEFORE_WAITING_STATUS && !is_waiting {
                    is_waiting = true;
                    debug!("No telemetry for 3s, waiting...");
                    app.emit(
                        EVENT_STATUS,
                        &SimStatus {
                            status: "waiting".into(),
                            sim: Some(source.sim_type()),
                            replay: source.replay_name(),
                        },
                    )
                    .ok();
                }

                continue;
            }
            SourceReadResult::Disconnected => {
                info!("{:?} stopped broadcasting (sim closed)", source.sim_type());
                return;
            }
        };

        missed_waits = 0;

        tick += 1;

        if is_waiting {
            is_waiting = false;
            info!("Telemetry resumed after timeout");
            app.emit(
                EVENT_STATUS,
                &SimStatus {
                    status: "connected".into(),
                    sim: Some(source.sim_type()),
                    replay: source.replay_name(),
                },
            )
            .ok();
        }

        // Timed from here rather than around the emit alone: applying a
        // session is tick work too, and the reason it moved off this thread.
        let started = Instant::now();

        for command in session.commands.try_iter() {
            state.apply(command, service);
        }

        // Applied before the processors run, so a session that is parsed by
        // now is the one this tick computes on.
        for update in io.parsed_sessions() {
            apply_session_update(app, update, service, state);
        }

        if (tick == 1 || tick.is_multiple_of(SESSION_POLL_TICKS)) && source.session_changed() {
            if let Some(yaml) = source.poll_session() {
                io.parse_session(yaml);
            }
        }

        if tick == 1 {
            info!(
                speed = frame.car_dynamics.speed,
                rpm = frame.car_dynamics.rpm,
                gear = frame.car_dynamics.gear,
                "Connected to {:?} — first telemetry frame received",
                source.sim_type()
            );
            service.is_connected.store(true, Ordering::Relaxed);
            app.emit(
                EVENT_STATUS,
                &SimStatus {
                    status: "connected".into(),
                    sim: Some(source.sim_type()),
                    replay: source.replay_name(),
                },
            )
            .ok();
        }

        let due = scheduler.due(Instant::now());

        let ctx = EmitContext {
            app,
            io: &io,
            frame: &frame,
            due,
            service,
            state,
            capabilities: session.capabilities,
        };

        let measuring = emit_domain_frames(ctx);
        let elapsed = started.elapsed().saturating_sub(measuring);

        lock_or_recover(&service.tick_timings).record(elapsed);
    }
}

/// The worker answering this connection's sessions and writing its files.
fn spawn_io_worker(app: &AppHandle, source: &dyn TelemetrySource) -> IoWorker {
    let data_dir = app
        .path()
        .app_data_dir()
        .inspect_err(|e| warn!("No app data dir, tracks and laps are not stored: {e}"))
        .ok();
    let emitting_app = app.clone();

    IoWorker::spawn(
        data_dir,
        source.session_parser(),
        Box::new(move |payload: &TrackShapePayload| {
            if let Err(e) = emitting_app.emit(EVENT_TRACK_SHAPE, payload) {
                warn!("Failed to re-emit track shape after pit pct patch: {}", e);
            }
        }),
    )
}

fn apply_session_update(
    app: &AppHandle,
    update: SessionUpdate,
    service: &TelemetryServiceState,
    state: &mut LoopState,
) {
    let SessionUpdate {
        parsed,
        cached_track,
        stored_reference_times,
    } = update;
    let snapshot = parsed.snapshot;
    let new_track_id = snapshot.track_id;

    let prev_track_id = state.session.as_deref().map(|s| s.track_id);

    info!(
        track = %snapshot.track_display_name,
        "Session info updated"
    );

    // A new track means a new event, and the grid below is only snapshotted once per
    // session number — which repeats across events. Drop the old one first or the
    // stale grid wins.
    if prev_track_id.is_some_and(|track_id| track_id != new_track_id) {
        state.clear_start_positions();
    }

    state.update_start_positions(&snapshot);
    state.track_length_m = Some(snapshot.track_length_m);

    if let Err(e) = app.emit(EVENT_SESSION_INFO, &snapshot) {
        warn!("Failed to emit session info: {}", e);
    }

    let snapshot = Arc::new(snapshot);

    state.session = Some(Arc::clone(&snapshot));
    service.publish_session(Some(snapshot));

    // The worker reads the shape only on a track change, judged against the
    // session it parsed before — the same one applied here before this.
    if let Some(payload) = cached_track {
        apply_cached_track(app, payload, state);
    }

    state
        .registry
        .command(ProcessorCommand::StoredReferenceTimes(
            stored_reference_times,
        ));

    if !parsed.weather_forecast.is_empty() {
        debug!(
            "Weather forecast: {} entries emitted",
            parsed.weather_forecast.len()
        );

        if let Err(e) = app.emit(EVENT_WEATHER_FORECAST, &parsed.weather_forecast) {
            warn!("Failed to emit weather forecast: {}", e);
        }
    }
}

fn reset_telemetry_state(app: &AppHandle, service: &TelemetryServiceState, state: &mut LoopState) {
    service.is_connected.store(false, Ordering::Relaxed);
    service.publish_session(None);
    state.reset_connection();

    app.emit(
        EVENT_STATUS,
        &SimStatus {
            status: "disconnected".into(),
            sim: None,
            replay: None,
        },
    )
    .ok();
    app.emit(EVENT_DISCONNECTED, &()).ok();
}

fn apply_cached_track(app: &AppHandle, payload: TrackShapePayload, state: &mut LoopState) {
    state.pit_in_pct = payload.pit_in_pct;
    state.pit_exit_pct = payload.pit_exit_pct;

    if let Err(e) = app.emit(EVENT_TRACK_SHAPE, &payload) {
        warn!("Failed to emit cached track shape: {}", e);
    }

    // Tells TrackShapeProcessor to skip re-recording since the track already exists.
    state
        .registry
        .command(ProcessorCommand::TrackCached(payload.track_id));
}
