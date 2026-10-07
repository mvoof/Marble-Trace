/// Everything only the telemetry thread writes, owned by it.
///
/// Plain fields, no locks: commands reach this through `TelemetryCommand`s the
/// loop applies at the top of a tick, and what other threads read of it is
/// published to `TelemetryServiceState` when it changes.
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use crate::computations::pit_auto::PitAuto;
use crate::computations::reference_selection::{ReferenceChange, ReferenceSelection};
use crate::computations::{driver_entries, ProcessorCommand, ProcessorRegistry};
use crate::model::pit_action::PitAction;
use crate::model::session::SessionSnapshot;
use crate::telemetry::control::{TelemetryCommand, TelemetryConfig};
use crate::telemetry::publications::PublicationRegistry;
use crate::telemetry::state::TelemetryServiceState;

/// Start grid positions keyed by carIdx: (overall_pos, class_pos), 1-indexed.
pub type StartPositions = HashMap<i32, (i32, i32)>;

/// `start_positions_session_num` before any grid was taken.
const NO_SESSION_NUM: i32 = -1;

/// A pit key pressed while the stream stalled — a loading screen, the sim
/// paused — is dropped rather than sent once frames resume: an order the driver
/// gave seconds ago is no longer the one they want.
const MAX_PIT_ACTION_AGE: Duration = Duration::from_secs(1);

pub struct LoopState {
    pub config: TelemetryConfig,
    /// All stateful processors. Reset on disconnect.
    pub registry: ProcessorRegistry,
    /// What was last put on the wire for each delivery group, so an unchanged
    /// frame can be held back. One record per mask value: a group seen for the
    /// first time must get a full bundle rather than inherit what another group
    /// was sent. Lives with the connection: a reconnect clears it, because the
    /// windows have reset their stores too and need a full bundle again.
    pub publications: PublicationRegistry,
    pub session: Option<Arc<SessionSnapshot>>,
    pub track_length_m: Option<f32>,
    pub start_positions: StartPositions,
    /// Session number for which start_positions was last populated.
    pub start_positions_session_num: i32,
    pub pit_in_pct: Option<f32>,
    pub pit_exit_pct: Option<f32>,
    /// Lap distance where the player's `on_pit_road` last went true, cleared on
    /// the way out. The recorded `pit_in_pct` says how long the lane is; this
    /// says where this particular entry began, which is what the pit approach
    /// rail counts from.
    pub live_pit_in_pct: Option<f32>,
    /// Auto pit mode: the overrides, latches and edges it decides on.
    pub pit_auto: PitAuto,
    /// Manual pit actions applied this tick, resolved by the emitter against
    /// the frame it holds.
    pub pending_pit_actions: Vec<PitAction>,
    /// The fuel calculation's last `fill_now`. Computed on the 4 Hz tier, read
    /// by a pit action on any tick.
    pub planned_fuel_l: Option<f32>,
    /// The stored reference laps and which one is active.
    pub references: ReferenceSelection,
    /// A change to the active reference not yet announced — published at the
    /// top of the next tick, before the coach computes on it.
    pub pending_reference: ReferenceChange,
    /// The track wetness of the last frame, for a session that arrives between two.
    pub track_wetness: Option<i32>,
}

impl LoopState {
    pub fn new(config: TelemetryConfig) -> Self {
        Self {
            config,
            registry: ProcessorRegistry::default(),
            publications: PublicationRegistry::default(),
            session: None,
            track_length_m: None,
            start_positions: StartPositions::new(),
            start_positions_session_num: NO_SESSION_NUM,
            pit_in_pct: None,
            pit_exit_pct: None,
            live_pit_in_pct: None,
            pit_auto: PitAuto::default(),
            pending_pit_actions: Vec::new(),
            planned_fuel_l: None,
            references: ReferenceSelection::default(),
            pending_reference: None,
            track_wetness: None,
        }
    }

    pub fn apply(&mut self, command: TelemetryCommand, service: &TelemetryServiceState) {
        match command {
            TelemetryCommand::Configure(config) => {
                // The command cleared it already; this catches a frame the
                // loop stored between that and here.
                if !config.inspector_active {
                    service.clear_inspector_frame();
                }

                self.config = config;
            }
            TelemetryCommand::ForceTrackStart => {
                self.registry.command(ProcessorCommand::ForceTrackStart);
            }
            TelemetryCommand::ClearTrackShape => {
                self.registry.command(ProcessorCommand::ClearTrackShape);
            }
            TelemetryCommand::ResetPitLane => {
                self.pit_in_pct = None;
                self.pit_exit_pct = None;
                self.registry.command(ProcessorCommand::ResetPitLane);
            }
            TelemetryCommand::ResetReferenceLap => {
                self.registry.command(ProcessorCommand::ResetReferenceLap);
                let change = self.references.clear();
                self.note_reference(change);
            }
            TelemetryCommand::PitAuto(command) => {
                self.pit_auto.command(command, &self.config.pit_auto);
            }
            TelemetryCommand::PitAction { action, issued_at } => {
                if issued_at.elapsed() <= MAX_PIT_ACTION_AGE {
                    self.pending_pit_actions.push(action);
                }
            }
        }
    }

    /// What a connection leaves behind that the next one must not inherit.
    /// The config stays: it is the user's, not the connection's.
    pub fn reset_connection(&mut self) {
        self.session = None;
        self.track_length_m = None;
        // Without qualifying data the grid is snapshotted once per session number, and those
        // repeat from event to event — a stale grid would survive the reconnect and silently
        // become the baseline for the next race's gain/loss column.
        self.clear_start_positions();
        self.registry.reset_all();
        // The windows drop their frames on disconnect, so nothing held back may be
        // treated as still delivered — the next connection republishes in full.
        self.publications.reset();
        self.pit_auto.reset();
        self.pending_pit_actions.clear();
        self.planned_fuel_l = None;
        self.references = ReferenceSelection::default();
        self.pending_reference = None;
        self.track_wetness = None;
    }

    /// Queues a change of the active reference for the next tick to announce.
    /// A later change in the same tick replaces an earlier one: only where the
    /// reference ends up matters.
    pub fn note_reference(&mut self, change: ReferenceChange) {
        if change.is_some() {
            self.pending_reference = change;
        }
    }

    /// Forgets the cached grid, so the next session snapshots its own.
    pub fn clear_start_positions(&mut self) {
        self.start_positions.clear();
        self.start_positions_session_num = NO_SESSION_NUM;
    }

    /// Updates start_positions from QualifyResultsInfo (the pre-race grid order).
    /// Falls back to ResultsPositions only when qualify data is absent AND start_positions has
    /// not yet been populated for this session — preventing live race order from overwriting
    /// the initial grid on repeated session-info updates.
    pub fn update_start_positions(&mut self, session: &SessionSnapshot) {
        let session_num = session.current_session_num;

        // Qualify results are immutable — always safe to refresh from them.
        if !session.qualify_results.is_empty() {
            self.start_positions =
                driver_entries::parse_start_positions_from_qualify(&session.qualify_results);
            self.start_positions_session_num = session_num;

            return;
        }

        // No qualify data: use ResultsPositions, but only once per session.
        // ResultsPositions reflects live race order after the race starts, so re-applying it
        // on subsequent session-info updates would overwrite the starting grid with current pos.
        let session_changed =
            std::mem::replace(&mut self.start_positions_session_num, session_num) != session_num;

        if !session_changed && !self.start_positions.is_empty() {
            return;
        }

        let current_num = session_num as usize;
        let results = session
            .sessions
            .get(current_num)
            .map(|s| s.results_positions.as_slice())
            .unwrap_or(&[]);

        let new_positions = driver_entries::parse_start_positions(results);

        if !new_positions.is_empty() {
            self.start_positions = new_positions;
        }
    }
}
