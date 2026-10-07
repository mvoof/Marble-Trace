//! One timed measurement run on a tape, for the perf harness.
//!
//! Switched on by `MARBLE_TRACE_PERF` (a path for the JSON report) next to
//! `MARBLE_TRACE_REPLAY`, `dev` builds only. The backend keeps the clock: once
//! the tape is playing and the warm-up is over it resets the delivery counters
//! and the tick timings, tells the overlays to start collecting, and after the
//! run tells them to stop. Each overlay answers with its own measurements;
//! the backend adds its own, writes the report and exits the app.
//!
//! `scripts/perf-run.mjs` launches this and prints the report as a table.

use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager};
use tracing::{error, info, warn};

use super::delivery::DeliverySet;
use super::state::TelemetryState;
use super::tick_timings::TickSummary;
use crate::model::events::{EVENT_PERF_BEGIN, EVENT_PERF_END};
use crate::sources::replay::{REPLAY_ENV, REPLAY_FROM_ENV};
use crate::utils::lock_or_recover;

/// Path the JSON report is written to; its presence starts a run.
pub const PERF_ENV: &str = "MARBLE_TRACE_PERF";
/// Measured span in seconds.
pub const PERF_SECONDS_ENV: &str = "MARBLE_TRACE_PERF_SECONDS";
/// Seconds of playback before the measured span starts.
pub const PERF_WARMUP_ENV: &str = "MARBLE_TRACE_PERF_WARMUP";
/// `widgets` (the default) or `stores-only`.
pub const PERF_MODE_ENV: &str = "MARBLE_TRACE_PERF_MODE";
/// Set to `1` when `scripts/perf-run.mjs` takes a sampling heap profile over
/// CDP: the overlays then hold their report until the profile is taken.
pub const PERF_HEAP_ENV: &str = "MARBLE_TRACE_PERF_HEAP";

const DEFAULT_SECONDS: u32 = 60;
const DEFAULT_WARMUP_SECONDS: u32 = 10;
const MILLIS_PER_SECOND: u32 = 1000;
const STORES_ONLY_MODE: &str = "stores-only";
const OVERLAY_LABEL_PREFIX: &str = "overlay-";

/// Longest wait for the tape to connect before the run is given up.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(120);
/// Longest wait for the overlays' reports once the run has ended. Generous,
/// because with a heap profile they wait for the profiler to finish first.
const REPORT_TIMEOUT: Duration = Duration::from_secs(60);
const POLL_INTERVAL: Duration = Duration::from_millis(100);

/// What an overlay needs to know about the run, read once when it loads.
#[derive(Debug, Clone, serde::Serialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct PerfRunConfig {
    pub duration_ms: u32,
    pub warmup_ms: u32,
    /// Receive and apply telemetry with no widget mounted, so the transport's
    /// share of the cost can be read off against a run with widgets.
    pub stores_only: bool,
    /// A heap profile is being taken from outside; see `PERF_HEAP_ENV`.
    pub heap_profile: bool,
    #[serde(skip)]
    pub output: PathBuf,
}

/// Percentiles of one timed operation, in milliseconds.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct TimingSummary {
    pub count: u32,
    pub p50_ms: f64,
    pub p99_ms: f64,
    pub max_ms: f64,
}

/// One overlay window's measurements over the run.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct OverlayPerfReport {
    pub label: String,
    pub elapsed_ms: f64,
    /// Widget types mounted on this overlay's monitor; empty in stores-only.
    pub widgets: Vec<String>,
    /// Sum of positive `usedJSHeapSize` deltas, sampled every 50 ms. `None`
    /// when the reading never moved: without `--enable-precise-memory-info`
    /// Chromium serves a cached, bucketed figure.
    pub alloc_bytes_per_sec: Option<f64>,
    /// Tasks of 50 ms or more — the floor of the browser's long-task API.
    pub long_tasks: u32,
    pub long_task_ms: f64,
    /// Animation frames, and those that took longer than a 60 Hz frame and a
    /// half — the finer-grained stand-in for "tasks over 16 ms".
    pub frames: u32,
    pub frames_over_budget: u32,
    pub dom_mutations_per_sec: f64,
    /// `None` in a production frontend, where `mobx.spy` is a no-op.
    pub observer_wakeups_per_sec: Option<f64>,
    /// `applyTelemetryBundle` on ticks that carry no 1 Hz tier.
    pub apply: TimingSummary,
    /// `applyTelemetryBundle` on the 1 Hz full-bundle ticks.
    pub apply_full: TimingSummary,
    /// Navigation start to the window's first contentful paint — the overlay's
    /// cold start. `None` when the page had painted nothing by the report.
    #[serde(default)]
    pub first_paint_ms: Option<f64>,
    /// `usedJSHeapSize` read as that first paint was observed: the heap the
    /// window boots into, before the run's telemetry fills it.
    #[serde(default)]
    pub heap_at_first_paint_bytes: Option<f64>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PerfReport<'a> {
    config: &'a PerfRunConfig,
    tape: Option<String>,
    replay_from_seconds: Option<String>,
    tick: TickSummary,
    delivery: Vec<DeliverySet>,
    overlays: Vec<OverlayPerfReport>,
}

/// The run's configuration and the reports collected so far.
#[derive(Default)]
pub struct PerfRunState {
    pub config: Option<PerfRunConfig>,
    pub reports: Mutex<Vec<OverlayPerfReport>>,
}

impl PerfRunConfig {
    /// The run `MARBLE_TRACE_PERF` asks for.
    pub fn from_env() -> Option<Self> {
        let output = PathBuf::from(std::env::var_os(PERF_ENV)?);
        let seconds = env_seconds(PERF_SECONDS_ENV).unwrap_or(DEFAULT_SECONDS);
        let warmup = env_seconds(PERF_WARMUP_ENV).unwrap_or(DEFAULT_WARMUP_SECONDS);
        let stores_only = std::env::var(PERF_MODE_ENV)
            .is_ok_and(|mode| mode.trim().eq_ignore_ascii_case(STORES_ONLY_MODE));

        let heap_profile = std::env::var(PERF_HEAP_ENV).is_ok_and(|value| value.trim() == "1");

        Some(Self {
            heap_profile,
            duration_ms: seconds.saturating_mul(MILLIS_PER_SECOND),
            warmup_ms: warmup.saturating_mul(MILLIS_PER_SECOND),
            stores_only,
            output,
        })
    }
}

fn env_seconds(name: &str) -> Option<u32> {
    std::env::var(name).ok()?.trim().parse().ok()
}

/// Starts the run's clock on a thread of its own, if a run was asked for.
pub fn spawn_if_requested(app: &AppHandle) {
    let Some(config) = app.state::<PerfRunState>().config.clone() else {
        return;
    };

    info!(
        "Perf run: {} s after {} s warm-up, stores-only {}, report to {}",
        config.duration_ms / MILLIS_PER_SECOND,
        config.warmup_ms / MILLIS_PER_SECOND,
        config.stores_only,
        config.output.display()
    );

    let app = app.clone();

    std::thread::spawn(move || run(&app, &config));
}

fn run(app: &AppHandle, config: &PerfRunConfig) {
    let telemetry = app.state::<TelemetryState>();
    let service = &telemetry.service;

    if !wait_until(CONNECT_TIMEOUT, || {
        service.is_connected.load(Ordering::Relaxed)
    }) {
        error!("Perf run: the tape never connected — is MARBLE_TRACE_REPLAY set?");
        app.exit(1);

        return;
    }

    std::thread::sleep(Duration::from_millis(u64::from(config.warmup_ms)));

    lock_or_recover(&service.delivery).reset();
    lock_or_recover(&service.tick_timings).reset();
    lock_or_recover(&app.state::<PerfRunState>().reports).clear();
    app.emit(EVENT_PERF_BEGIN, ()).ok();

    std::thread::sleep(Duration::from_millis(u64::from(config.duration_ms)));

    let tick = lock_or_recover(&service.tick_timings).summary();
    let delivery = lock_or_recover(&service.delivery).snapshot();
    app.emit(EVENT_PERF_END, ()).ok();

    let expected = overlay_count(app);
    let state = app.state::<PerfRunState>();
    let complete = wait_until(REPORT_TIMEOUT, || {
        lock_or_recover(&state.reports).len() >= expected
    });

    if !complete {
        warn!("Perf run: not every overlay reported back");
    }

    let report = PerfReport {
        config,
        tape: std::env::var(REPLAY_ENV).ok(),
        replay_from_seconds: std::env::var(REPLAY_FROM_ENV).ok(),
        tick,
        delivery,
        overlays: lock_or_recover(&state.reports).clone(),
    };

    match serde_json::to_vec_pretty(&report)
        .map_err(std::io::Error::other)
        .and_then(|json| std::fs::write(&config.output, json))
    {
        Ok(()) => {
            info!("Perf run: report written to {}", config.output.display());
            app.exit(0);
        }
        Err(write_error) => {
            error!("Perf run: report cannot be written: {write_error}");
            app.exit(1);
        }
    }
}

fn overlay_count(app: &AppHandle) -> usize {
    app.webview_windows()
        .keys()
        .filter(|label| label.starts_with(OVERLAY_LABEL_PREFIX))
        .count()
}

fn wait_until(timeout: Duration, mut condition: impl FnMut() -> bool) -> bool {
    let deadline = Instant::now() + timeout;

    while !condition() {
        if Instant::now() >= deadline {
            return false;
        }

        std::thread::sleep(POLL_INTERVAL);
    }

    true
}
