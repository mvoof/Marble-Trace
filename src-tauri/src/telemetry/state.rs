/// Managed state shared between Tauri commands and the telemetry thread.
///
/// Only what actually crosses threads lives here. Everything the loop alone
/// writes — the session it computes on, the grid, the pit lane markers, the
/// processors — is owned by the thread (`telemetry::loop_state`), and commands
/// reach it through `TelemetryCommand`s rather than shared fields.
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use crate::model::reference_lap::ReferenceLapData;
use crate::model::session::SessionSnapshot;
use crate::sources::raw::{RawSession, RawValues, RawVarMeta, SessionTreeParser};
use crate::sources::source::SourceFrame;
use crate::telemetry::control::{Control, TelemetryCommand, TelemetryConfig, TelemetryRun};
use crate::telemetry::delivery::DeliveryCounters;
use crate::telemetry::masks::MaskRegistry;
#[cfg(feature = "dev")]
use crate::telemetry::tick_timings::TickTimings;
use crate::utils::lock_or_recover;

/// Shared state for the telemetry service.
pub struct TelemetryServiceState {
    /// The id of the run allowed to go on; 0 = stopped.
    running: AtomicU64,
    /// Published by the loop: a frame has arrived on the current connection.
    pub is_connected: AtomicBool,
    /// The command sender and the config the next run starts with.
    control: Mutex<Control>,
    /// The session the loop computes on, published each time it applies one.
    session: Mutex<Option<Arc<SessionSnapshot>>>,
    /// Last adapted frame, refreshed on the 4 Hz tier while the inspector is
    /// open. 4 Hz because that is already faster than a person can read a table
    /// of a hundred numbers.
    pub inspector_frame: Mutex<Option<SourceFrame>>,
    /// Every variable's value under the sim's own names, on the same tier and
    /// under the same switch as `inspector_frame`.
    pub inspector_raw_values: Mutex<Option<RawValues>>,
    /// The sim's variable list for this connection. Set once when it opens.
    raw_var_meta: Mutex<Vec<RawVarMeta>>,
    /// The session text as the sim last wrote it, with the parser that turns it
    /// into a tree. Kept whether the inspector is open or not: it changes a few
    /// times a session, and the clone is one string per change.
    raw_session: Mutex<Option<(String, SessionTreeParser)>>,
    /// The reference lap the loop has made active, for a window that opens
    /// after the event announcing it went out.
    active_reference: Mutex<Option<Arc<ReferenceLapData>>>,
    /// What each recipient is asking for, keyed by its window label, and the
    /// union of it that the emitter fills the bundle from.
    pub masks: MaskRegistry,
    /// How many bundles each recipient received, and how many of those carried
    /// each demand-gated field. The instrument the per-window mask work is
    /// measured with; see `telemetry::delivery`.
    pub delivery: Mutex<DeliveryCounters>,
    /// How long each `emit_domain_frames` pass took, reset together with the
    /// delivery counters so one measurement run reads both over one span.
    /// Only the perf run reads it, so only a `dev` build records it.
    #[cfg(feature = "dev")]
    pub tick_timings: Mutex<TickTimings>,
}

impl Default for TelemetryServiceState {
    fn default() -> Self {
        Self {
            running: AtomicU64::new(0),
            is_connected: AtomicBool::new(false),
            control: Mutex::new(Control::default()),
            session: Mutex::new(None),
            inspector_frame: Mutex::new(None),
            inspector_raw_values: Mutex::new(None),
            raw_var_meta: Mutex::new(Vec::new()),
            raw_session: Mutex::new(None),
            active_reference: Mutex::new(None),
            masks: MaskRegistry::bootstrapped(),
            delivery: Mutex::new(DeliveryCounters::with_broadcast()),
            #[cfg(feature = "dev")]
            tick_timings: Mutex::new(TickTimings::default()),
        }
    }
}

impl TelemetryServiceState {
    /// Hands a change to the running thread, if there is one. A one-shot
    /// command sent while the stream is stopped is dropped: what it would reset
    /// is rebuilt from disk when the next run reads its session.
    pub fn send(&self, command: TelemetryCommand) {
        lock_or_recover(&self.control).send(command);
    }

    /// Changes a value that has to survive a stop, and tells the thread.
    pub fn configure(&self, change: impl FnOnce(&mut TelemetryConfig)) {
        lock_or_recover(&self.control).configure(change);
    }

    /// Makes a new run the current one and returns what its thread starts
    /// with. A thread of an older run sees it is no longer current and stops.
    pub fn begin_run(&self) -> TelemetryRun {
        let run = lock_or_recover(&self.control).begin_run();

        self.running.store(run.id, Ordering::SeqCst);

        run
    }

    pub fn stop(&self) {
        self.running.store(0, Ordering::SeqCst);
    }

    pub fn is_current(&self, run: u64) -> bool {
        self.running.load(Ordering::SeqCst) == run
    }

    /// A newer run was started over this one, as opposed to the stream being
    /// stopped. The newer thread now speaks for the connection, so this one
    /// must leave without announcing a disconnect.
    pub fn is_superseded(&self, run: u64) -> bool {
        let current = self.running.load(Ordering::SeqCst);

        current != 0 && current != run
    }

    pub fn session(&self) -> Option<Arc<SessionSnapshot>> {
        lock_or_recover(&self.session).clone()
    }

    pub fn publish_session(&self, session: Option<Arc<SessionSnapshot>>) {
        *lock_or_recover(&self.session) = session;
    }

    pub fn active_reference(&self) -> Option<Arc<ReferenceLapData>> {
        lock_or_recover(&self.active_reference).clone()
    }

    pub fn publish_active_reference(&self, reference: Option<Arc<ReferenceLapData>>) {
        *lock_or_recover(&self.active_reference) = reference;
    }

    pub fn clear_inspector_frame(&self) {
        *lock_or_recover(&self.inspector_frame) = None;
        *lock_or_recover(&self.inspector_raw_values) = None;
    }

    pub fn publish_inspector_raw_values(&self, values: Option<RawValues>) {
        *lock_or_recover(&self.inspector_raw_values) = values;
    }

    pub fn raw_var_meta(&self) -> Vec<RawVarMeta> {
        lock_or_recover(&self.raw_var_meta).clone()
    }

    pub fn publish_raw_var_meta(&self, meta: Vec<RawVarMeta>) {
        *lock_or_recover(&self.raw_var_meta) = meta;
    }

    pub fn publish_raw_session(&self, session: Option<(String, SessionTreeParser)>) {
        *lock_or_recover(&self.raw_session) = session;
    }

    /// The session text and its tree. The tree is parsed here, on the command
    /// asking for it, so the telemetry thread only ever copies a string.
    pub fn raw_session(&self) -> Option<RawSession> {
        let (yaml, parse_tree) = lock_or_recover(&self.raw_session).clone()?;
        let tree = parse_tree(&yaml);

        Some(RawSession { yaml, tree })
    }
}

/// The telemetry service as Tauri manages it.
#[derive(Default)]
pub struct TelemetryState {
    pub service: Arc<TelemetryServiceState>,
}
