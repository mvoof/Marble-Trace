/// Managed state shared between Tauri commands and the telemetry thread.
///
/// Only what actually crosses threads lives here. Everything the loop alone
/// writes — the session it computes on, the grid, the pit lane markers, the
/// processors — is owned by the thread (`telemetry::loop_state`), and commands
/// reach it through `TelemetryCommand`s rather than shared fields.
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use crate::model::session::SessionSnapshot;
use crate::sources::source::SourceFrame;
use crate::telemetry::control::{Control, TelemetryCommand, TelemetryConfig, TelemetryRun};
use crate::telemetry::delivery::DeliveryCounters;
use crate::telemetry::masks::MaskRegistry;
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
    /// What each recipient is asking for, keyed by its window label, and the
    /// union of it that the emitter fills the bundle from.
    pub masks: MaskRegistry,
    /// How many bundles each recipient received, and how many of those carried
    /// each demand-gated field. The instrument the per-window mask work is
    /// measured with; see `telemetry::delivery`.
    pub delivery: Mutex<DeliveryCounters>,
    /// How long each `emit_domain_frames` pass took, reset together with the
    /// delivery counters so one measurement run reads both over one span.
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
            masks: MaskRegistry::bootstrapped(),
            delivery: Mutex::new(DeliveryCounters::with_broadcast()),
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

    pub fn clear_inspector_frame(&self) {
        *lock_or_recover(&self.inspector_frame) = None;
    }
}

/// The telemetry service as Tauri manages it.
#[derive(Default)]
pub struct TelemetryState {
    pub service: Arc<TelemetryServiceState>,
}
