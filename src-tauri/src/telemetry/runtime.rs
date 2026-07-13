/// Telemetry thread lifecycle: connect, main loop, reconnect, state reset.
///
/// Runs on a dedicated OS thread — kerb's `IRsdkConnection` is `!Send`
/// (RefCell + raw shared-memory pointers). All kerb usage is encapsulated
/// inside `IracingSource`.
use std::collections::HashMap;
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager};

use crate::utils::lock_or_recover;
use tracing::{debug, info, warn};

use super::emitter::{
    emit_domain_frames, EmitContext, EVENT_CAPABILITIES, EVENT_DISCONNECTED, EVENT_SESSION_INFO,
    EVENT_STATUS, EVENT_TRACK_SHAPE, EVENT_WEATHER_FORECAST,
};
use super::scheduler::EmitScheduler;
use super::state::TelemetryServiceState;
use crate::computations::{standings, ProcessorRegistry};
use crate::model::capabilities::CapabilitiesPayload;
use crate::model::enums::{SimStatus, SimType};
use crate::model::session::SessionSnapshot;
use crate::sources::create_source;
use crate::sources::source::{ParsedSession, SourceReadResult, TelemetrySource};

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
    registry: Arc<Mutex<ProcessorRegistry>>,
    pit_warning_laps: Arc<std::sync::atomic::AtomicU32>,
) -> Result<(), String> {
    let spawn_result = std::thread::Builder::new()
        .name("telemetry-runtime".into())
        .spawn(move || {
            info!("Telemetry thread started");

            loop {
                if !service.running.load(Ordering::SeqCst) {
                    info!("Telemetry thread stopping (service not running)");
                    break;
                }

                app.emit(
                    EVENT_STATUS,
                    &SimStatus {
                        status: "waiting".into(),
                        sim: None,
                    },
                )
                .ok();
                info!("Waiting for telemetry connection...");

                let Some(mut source) = wait_for_connection(&service) else {
                    return;
                };

                let capabilities = source.capabilities();
                let caps_payload = CapabilitiesPayload::from(capabilities);

                info!("Connected to {:?} shared memory", source.sim_type());

                if let Err(e) = app.emit(EVENT_CAPABILITIES, &caps_payload) {
                    warn!("Failed to emit capabilities: {e}");
                }

                run_telemetry_loop(
                    &app,
                    source.as_mut(),
                    &service,
                    &registry,
                    &pit_warning_laps,
                    capabilities,
                );

                info!("Telemetry loop ended, will retry connection...");
                reset_telemetry_state(&app, &service, &registry);

                if !service.running.load(Ordering::SeqCst) {
                    break;
                }
            }
        });

    spawn_result
        .map(|_| ())
        .map_err(|e| format!("Failed to spawn telemetry thread: {e}"))
}

fn wait_for_connection(service: &TelemetryServiceState) -> Option<Box<dyn TelemetrySource>> {
    loop {
        if !service.running.load(Ordering::SeqCst) {
            return None;
        }

        if let Some(src) = create_source(SimType::IRacing) {
            return Some(src);
        }

        std::thread::sleep(CONNECT_RETRY_DELAY);
    }
}

fn run_telemetry_loop(
    app: &AppHandle,
    source: &mut dyn TelemetrySource,
    service: &Arc<TelemetryServiceState>,
    registry: &Arc<Mutex<ProcessorRegistry>>,
    pit_warning_laps: &Arc<std::sync::atomic::AtomicU32>,
    capabilities: crate::capabilities::Capabilities,
) {
    let mut tick: u64 = 0;
    let mut is_waiting = false;
    let mut missed_waits: u32 = 0;
    let mut scheduler = EmitScheduler::new();

    loop {
        if !service.running.load(Ordering::SeqCst) {
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
                },
            )
            .ok();
        }

        if (tick == 1 || tick.is_multiple_of(SESSION_POLL_TICKS)) && source.session_changed() {
            if let Some(parsed) = source.poll_session() {
                apply_session_update(app, parsed, service);
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
                },
            )
            .ok();
        }

        let due = scheduler.due(Instant::now());
        let pit_warning = f32::from_bits(pit_warning_laps.load(Ordering::Relaxed));

        let ctx = EmitContext {
            app,
            frame: &frame,
            due,
            service,
            registry,
            pit_warning_laps: pit_warning,
            capabilities,
        };

        emit_domain_frames(ctx);
    }
}

fn apply_session_update(app: &AppHandle, parsed: ParsedSession, service: &TelemetryServiceState) {
    let snapshot = parsed.snapshot;
    let new_track_id = snapshot.track_id;

    let prev_track_id = {
        let prev = lock_or_recover(&service.last_session_info);
        prev.as_deref().map(|s| s.track_id)
    };

    info!(
        track = %snapshot.track_display_name,
        "Session info updated"
    );

    update_start_positions(
        &snapshot,
        &service.start_positions,
        &service.start_positions_session_num,
    );

    if let Ok(mut lock) = service.track_length_m.lock() {
        *lock = Some(snapshot.track_length_m);
    }

    if let Err(e) = app.emit(EVENT_SESSION_INFO, &snapshot) {
        warn!("Failed to emit session info: {}", e);
    }

    if let Ok(mut lock) = service.last_session_info.lock() {
        *lock = Some(Arc::new(snapshot));
    }

    if prev_track_id != Some(new_track_id) {
        try_load_and_emit_track(app, new_track_id, service);
    }

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

fn reset_telemetry_state(
    app: &AppHandle,
    service: &Arc<TelemetryServiceState>,
    registry: &Arc<Mutex<ProcessorRegistry>>,
) {
    service.is_connected.store(false, Ordering::Relaxed);

    if let Ok(mut lock) = service.last_session_info.lock() {
        *lock = None;
    }

    if let Ok(mut lock) = service.track_length_m.lock() {
        *lock = None;
    }

    if let Ok(mut reg) = registry.lock() {
        reg.reset_all();
    }

    app.emit(
        EVENT_STATUS,
        &SimStatus {
            status: "disconnected".into(),
            sim: None,
        },
    )
    .ok();
    app.emit(EVENT_DISCONNECTED, &()).ok();
}

fn try_load_and_emit_track(app: &AppHandle, track_id: i32, service: &TelemetryServiceState) {
    use std::fs;

    use crate::model::track_shape::TrackShapePayload;

    #[derive(serde::Deserialize)]
    struct StoredTrack {
        version: u32,
        #[serde(flatten)]
        payload: TrackShapePayload,
    }

    let Ok(data_dir) = app.path().app_data_dir() else {
        return;
    };

    let path = data_dir.join("tracks").join(format!("{}.json", track_id));
    let Ok(json) = fs::read_to_string(&path) else {
        return;
    };

    let Ok(stored) = serde_json::from_str::<StoredTrack>(&json) else {
        return;
    };

    if stored.version < 1 {
        return;
    }

    if let Ok(mut lock) = service.pit_in_pct.lock() {
        *lock = stored.payload.pit_in_pct;
    }
    if let Ok(mut lock) = service.pit_exit_pct.lock() {
        *lock = stored.payload.pit_exit_pct;
    }

    if let Err(e) = app.emit(EVENT_TRACK_SHAPE, &stored.payload) {
        warn!("Failed to emit cached track shape: {}", e);
    }

    // Signal TrackShapeProcessor to skip re-recording since the track already exists.
    service.track_cached.store(track_id, Ordering::Relaxed);
}

/// Updates start_positions from QualifyResultsInfo (the pre-race grid order).
/// Falls back to ResultsPositions only when qualify data is absent AND start_positions has
/// not yet been populated for this session — preventing live race order from overwriting
/// the initial grid on repeated session-info updates.
fn update_start_positions(
    session: &SessionSnapshot,
    start_positions: &Mutex<HashMap<i32, (i32, i32)>>,
    last_session_num: &AtomicI32,
) {
    let session_num = session.current_session_num;

    // Qualify results are immutable — always safe to refresh from them.
    if !session.qualify_results.is_empty() {
        let new_positions = standings::parse_start_positions_from_qualify(&session.qualify_results);
        if let Ok(mut lock) = start_positions.lock() {
            *lock = new_positions;
        }
        last_session_num.store(session_num, Ordering::Relaxed);
        return;
    }

    // No qualify data: use ResultsPositions, but only once per session.
    // ResultsPositions reflects live race order after the race starts, so re-applying it
    // on subsequent session-info updates would overwrite the starting grid with current pos.
    let session_changed = last_session_num.swap(session_num, Ordering::Relaxed) != session_num;

    if !session_changed {
        if let Ok(lock) = start_positions.lock() {
            if !lock.is_empty() {
                return;
            }
        }
    }

    let current_num = session_num as usize;
    let results = session
        .sessions
        .get(current_num)
        .map(|s| s.results_positions.as_slice())
        .unwrap_or(&[]);

    let new_positions = standings::parse_start_positions(results);
    if !new_positions.is_empty() {
        if let Ok(mut lock) = start_positions.lock() {
            *lock = new_positions;
        }
    }
}
