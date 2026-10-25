/// Telemetry thread lifecycle: connect, main loop, reconnect, state reset.
///
/// Runs on a dedicated OS thread: a sim connection may be `!Send` (kerb's
/// iRacing one holds a RefCell and raw shared-memory pointers), so the source
/// is opened, read and dropped on this thread alone.
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::mpsc::Receiver;
use std::sync::Arc;
use std::time::{Duration, Instant};

#[cfg(feature = "dev")]
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
use mt_computations::ProcessorCommand;
use mt_model::capabilities::CapabilitiesPayload;
use mt_model::defaults::SOURCE_TICK_HZ;
use mt_model::enums::SimStatus;
use mt_model::event_sink::EventSink;
use mt_model::track_shape::TrackShapePayload;
use mt_source::{SourceReadResult, TelemetrySource};

const CONNECT_RETRY_DELAY: Duration = Duration::from_secs(1);
/// How long a single `wait_for_data` call blocks before we re-check state.
const WAIT_FOR_DATA_TIMEOUT_MS: u32 = 1000;
/// Consecutive wait timeouts before emitting the "waiting" status (~3s).
const MISSED_WAITS_BEFORE_WAITING_STATUS: u32 = 3;
/// Check the session version counter every N frames (~0.5s at 60 Hz).
const SESSION_POLL_TICKS: u64 = 30;

/// Opens a connection to whichever sim is running, `None` while none is. Called
/// on the telemetry thread, which is the only one the source ever lives on.
pub type SourceFactory = fn() -> Option<Box<dyn TelemetrySource>>;

/// What the app hands the runtime: where events go, where files are kept,
/// and how a sim is connected.
pub struct TelemetryHost {
    pub sink: Arc<dyn EventSink>,
    /// `None` when the app has no data directory: tracks and laps are then
    /// not stored.
    pub data_dir: Option<PathBuf>,
    pub connect: SourceFactory,
}

/// Spawn the dedicated telemetry thread; returns an error if the OS refuses.
pub fn spawn_telemetry_thread(
    host: TelemetryHost,
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
            let TelemetryHost {
                sink,
                data_dir,
                connect,
            } = host;

            loop {
                if !service.is_current(run) {
                    info!("Telemetry thread stopping (service not running)");
                    break;
                }

                sink.emit(
                    EVENT_STATUS,
                    &SimStatus {
                        status: "waiting".into(),
                        sim: None,
                        replay: None,
                    },
                )
                .ok();
                info!("Waiting for telemetry connection...");

                let Some(mut source) = wait_for_connection(connect, &service, run) else {
                    return;
                };

                let capabilities = source.capabilities();
                let caps_payload = CapabilitiesPayload::from(capabilities);

                info!("Connected to {:?} shared memory", source.sim_type());

                if let Err(e) = sink.emit(EVENT_CAPABILITIES, &caps_payload) {
                    warn!("Failed to emit capabilities: {e}");
                }

                let session = LoopSession {
                    run,
                    commands: &commands,
                    capabilities,
                    data_dir: data_dir.clone(),
                };

                run_telemetry_loop(&sink, source.as_mut(), &service, &mut state, session);

                if service.is_superseded(run) {
                    info!("Telemetry thread stopping (a newer run took over)");
                    break;
                }

                info!("Telemetry loop ended, will retry connection...");
                reset_telemetry_state(sink.as_ref(), &service, &mut state);

                if !service.is_current(run) {
                    break;
                }

                // The shared-memory handle can open successfully while iRacing is
                // only sitting in the lobby (not actually broadcasting), so the
                // loop above returns immediately without ever reading a frame.
                // Without this delay, that produces a tight reconnect spin that
                // floods the logs — wait_for_connection only backs off when
                // `connect` itself fails, which doesn't happen here.
                std::thread::sleep(CONNECT_RETRY_DELAY);
            }
        });

    spawn_result
        .map(|_| ())
        .map_err(|e| format!("Failed to spawn telemetry thread: {e}"))
}

fn wait_for_connection(
    connect: SourceFactory,
    service: &TelemetryServiceState,
    run: u64,
) -> Option<Box<dyn TelemetrySource>> {
    loop {
        if !service.is_current(run) {
            return None;
        }

        if let Some(src) = connect() {
            return Some(src);
        }

        std::thread::sleep(CONNECT_RETRY_DELAY);
    }
}

/// What one connection's loop runs with besides the state it carries over.
struct LoopSession<'a> {
    run: u64,
    commands: &'a Receiver<TelemetryCommand>,
    capabilities: mt_model::capabilities::Capabilities,
    data_dir: Option<PathBuf>,
}

fn run_telemetry_loop(
    sink: &Arc<dyn EventSink>,
    source: &mut dyn TelemetrySource,
    service: &TelemetryServiceState,
    state: &mut LoopState,
    session: LoopSession<'_>,
) {
    let mut tick: u64 = 0;
    let mut is_waiting = false;
    let mut missed_waits: u32 = 0;
    let mut scheduler = EmitScheduler::new();
    let io = spawn_io_worker(sink, session.data_dir.clone(), source);
    let pit = source.pit_commander();

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
                    sink.emit(
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
            sink.emit(
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
        #[cfg(feature = "dev")]
        let started = Instant::now();

        for command in session.commands.try_iter() {
            state.apply(command, service);
        }

        // Applied before the processors run, so a session that is parsed by
        // now is the one this tick computes on.
        for update in io.parsed_sessions() {
            apply_session_update(sink.as_ref(), update, service, state);
        }

        if (tick == 1 || tick.is_multiple_of(SESSION_POLL_TICKS)) && source.session_changed() {
            if let Some(yaml) = source.poll_session() {
                service.publish_raw_session(Some((yaml.clone(), source.session_tree_parser())));
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
            service.publish_raw_var_meta(source.raw_var_meta());
            sink.emit(
                EVENT_STATUS,
                &SimStatus {
                    status: "connected".into(),
                    sim: Some(source.sim_type()),
                    replay: source.replay_name(),
                },
            )
            .ok();
        }

        let publish_every = SOURCE_TICK_HZ / state.config.overlay_update_hz.max(1);
        let due = scheduler.due(Instant::now(), publish_every);

        // Read here rather than in the emitter: only the source can reach the
        // sim's own variables. Same tier and switch as the adapted frame.
        if due.hz4 && state.config.inspector_active {
            service.publish_inspector_raw_values(source.raw_values());
        }

        let ctx = EmitContext {
            sink: sink.as_ref(),
            io: &io,
            frame: &frame,
            due,
            service,
            state,
            capabilities: session.capabilities,
            pit: pit.as_deref(),
        };

        #[cfg(feature = "dev")]
        {
            let measuring = emit_domain_frames(ctx);
            let elapsed = started.elapsed().saturating_sub(measuring);

            lock_or_recover(&service.tick_timings).record(elapsed);
        }

        #[cfg(not(feature = "dev"))]
        emit_domain_frames(ctx);
    }
}

/// The worker answering this connection's sessions and writing its files.
fn spawn_io_worker(
    sink: &Arc<dyn EventSink>,
    data_dir: Option<PathBuf>,
    source: &dyn TelemetrySource,
) -> IoWorker {
    let emitting_sink = Arc::clone(sink);

    IoWorker::spawn(
        data_dir,
        source.session_parser(),
        Box::new(move |payload: &TrackShapePayload| {
            if let Err(e) = emitting_sink.emit(EVENT_TRACK_SHAPE, payload) {
                warn!("Failed to re-emit track shape after pit pct patch: {}", e);
            }
        }),
    )
}

fn apply_session_update(
    sink: &dyn EventSink,
    update: SessionUpdate,
    service: &TelemetryServiceState,
    state: &mut LoopState,
) {
    let SessionUpdate {
        parsed,
        cached_track,
        stored_references,
        saved_safety_rating,
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

    if let Err(e) = sink.emit(EVENT_SESSION_INFO, &snapshot) {
        warn!("Failed to emit session info: {}", e);
    }

    let snapshot = Arc::new(snapshot);

    state.session = Some(Arc::clone(&snapshot));
    service.publish_session(Some(Arc::clone(&snapshot)));

    // The worker reads the shape only on a track change, judged against the
    // session it parsed before — the same one applied here before this.
    if let Some(payload) = cached_track {
        apply_cached_track(sink, payload, state);
    }

    // Reaches the processor before its first tick on this session; one that
    // has already started counting this event ignores it.
    if let Some(saved) = saved_safety_rating {
        state
            .registry
            .command(ProcessorCommand::RestoreSafetyRating(Box::new(saved)));
    }

    let player_car = snapshot
        .cars
        .iter()
        .find(|car| car.car_idx == snapshot.player_car_idx)
        .map(|car| car.car_screen_name.as_str())
        .unwrap_or_default();
    let change = state.references.load(
        snapshot.track_id,
        player_car,
        stored_references,
        state.track_wetness,
    );

    state.note_reference(change);
    state
        .registry
        .command(ProcessorCommand::StoredReferenceTimes(
            state.references.stored_times(),
        ));

    if !parsed.weather_forecast.is_empty() {
        debug!(
            "Weather forecast: {} entries emitted",
            parsed.weather_forecast.len()
        );

        if let Err(e) = sink.emit(EVENT_WEATHER_FORECAST, &parsed.weather_forecast) {
            warn!("Failed to emit weather forecast: {}", e);
        }
    }
}

fn reset_telemetry_state(
    sink: &dyn EventSink,
    service: &TelemetryServiceState,
    state: &mut LoopState,
) {
    service.is_connected.store(false, Ordering::Relaxed);
    service.publish_session(None);
    service.publish_active_reference(None);
    service.publish_raw_var_meta(Vec::new());
    service.publish_raw_session(None);
    service.clear_inspector_frame();
    state.reset_connection();

    sink.emit(
        EVENT_STATUS,
        &SimStatus {
            status: "disconnected".into(),
            sim: None,
            replay: None,
        },
    )
    .ok();
    sink.emit(EVENT_DISCONNECTED, &()).ok();
}

fn apply_cached_track(sink: &dyn EventSink, payload: TrackShapePayload, state: &mut LoopState) {
    state.pit_in_pct = payload.pit_in_pct;
    state.pit_exit_pct = payload.pit_exit_pct;

    if let Err(e) = sink.emit(EVENT_TRACK_SHAPE, &payload) {
        warn!("Failed to emit cached track shape: {}", e);
    }

    // Tells TrackShapeProcessor to skip re-recording since the track already exists.
    state
        .registry
        .command(ProcessorCommand::TrackCached(payload.track_id));
}
