/// Managed state shared between Tauri commands and the telemetry thread.
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU32};
use std::sync::{Arc, Mutex};

use crate::computations::ProcessorRegistry;
use crate::model::session::SessionSnapshot;

/// Shared state for the telemetry service.
pub struct TelemetryServiceState {
    pub running: AtomicBool,
    pub is_connected: AtomicBool,
    pub last_session_info: Mutex<Option<Arc<SessionSnapshot>>>,
    /// Start grid positions keyed by carIdx: (overall_pos, class_pos), 1-indexed.
    pub start_positions: Mutex<HashMap<i32, (i32, i32)>>,
    /// Session number for which start_positions was last populated. -1 = never set.
    pub start_positions_session_num: AtomicI32,
    /// Cached track length in meters.
    pub track_length_m: Mutex<Option<f32>>,
    pub pit_in_pct: Mutex<Option<f32>>,
    pub pit_exit_pct: Mutex<Option<f32>>,
    /// Bitmask of active high-frequency events to emit.
    pub active_events: AtomicU32,
    /// Configurable player car length in meters.
    pub car_length_m: Mutex<f32>,
}

/// Bitmask flags for high-frequency events.
pub const EVENT_CAR_DYNAMICS: u32 = 1 << 0;
pub const EVENT_CAR_INPUTS: u32 = 1 << 1;
pub const EVENT_LAP_DELTA: u32 = 1 << 2;
pub const EVENT_CAR_POSITIONS: u32 = 1 << 3;

/// Compose domain-specific states.
pub struct TelemetryState {
    pub service: Arc<TelemetryServiceState>,
    /// All stateful processors. Reset on disconnect.
    pub registry: Arc<Mutex<ProcessorRegistry>>,
    /// User-configured pit warning laps (stored as bits of f32).
    pub pit_warning_laps: Arc<AtomicU32>,
    /// Set by reset_pit_lane_pct command; consumed by TrackShapeProcessor on next tick.
    pub reset_pit_pcts: Arc<AtomicBool>,
}
