/// Everything only the telemetry thread writes, owned by it.
///
/// Plain fields, no locks: commands reach this through `TelemetryCommand`s the
/// loop applies at the top of a tick, and what other threads read of it is
/// published to `TelemetryServiceState` when it changes.
use std::collections::HashMap;
use std::sync::Arc;

use crate::computations::pit_auto::PitAuto;
use crate::computations::{driver_entries, ProcessorCommand, ProcessorRegistry};
use crate::model::session::SessionSnapshot;
use crate::telemetry::control::{TelemetryCommand, TelemetryConfig};
use crate::telemetry::publications::PublicationRegistry;
use crate::telemetry::state::TelemetryServiceState;

/// Start grid positions keyed by carIdx: (overall_pos, class_pos), 1-indexed.
pub type StartPositions = HashMap<i32, (i32, i32)>;

/// `start_positions_session_num` before any grid was taken.
const NO_SESSION_NUM: i32 = -1;

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
    /// How many distinct car classes the last computed `driver_entries` held.
    /// Recorded on every Hz10 tick, before the demand gate, so the slow slice
    /// can carry it to the main window: the hotkey runner lives there and has
    /// to know how far the standings class cycle wraps without taking the
    /// per-car frame itself.
    pub car_class_count: u32,
    /// Auto pit mode: the overrides, latches and edges it decides on.
    pub pit_auto: PitAuto,
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
            car_class_count: 0,
            pit_auto: PitAuto::default(),
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
            }
            TelemetryCommand::PitAuto(command) => {
                self.pit_auto.command(command, &self.config.pit_auto);
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
        self.car_class_count = 0;
        self.pit_auto.reset();
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
