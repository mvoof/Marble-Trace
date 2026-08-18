/// Managed state shared between Tauri commands and the telemetry thread.
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU32, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use crate::computations::fuel::{FuelSettings, DEFAULT_FUEL_AVG_WINDOW, DEFAULT_PIT_WARNING_LAPS};
use crate::computations::ProcessorRegistry;
use crate::model::reference_lap::StoredReferenceTimes;
use crate::model::session::SessionSnapshot;
use crate::sources::source::SourceFrame;
use crate::telemetry::publications::Publications;

/// User-configured fuel parameters, written by commands and read once per tick
/// by the telemetry thread.
pub struct FuelTuning {
    /// Pit warning laps, stored as the bits of an f32.
    pub pit_warning_laps: AtomicU32,
    /// Laps averaged for consumption. 0 = the whole recorded history.
    pub avg_window: AtomicUsize,
}

impl Default for FuelTuning {
    fn default() -> Self {
        Self {
            pit_warning_laps: AtomicU32::new(DEFAULT_PIT_WARNING_LAPS.to_bits()),
            avg_window: AtomicUsize::new(DEFAULT_FUEL_AVG_WINDOW),
        }
    }
}

impl FuelTuning {
    pub fn snapshot(&self) -> FuelSettings {
        FuelSettings {
            pit_warning_laps: f32::from_bits(self.pit_warning_laps.load(Ordering::Relaxed)),
            avg_window: self.avg_window.load(Ordering::Relaxed),
        }
    }
}

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
    /// Lap distance where the player's `on_pit_road` last went true, cleared on
    /// the way out. The recorded `pit_in_pct` says how long the lane is; this
    /// says where this particular entry began, which is what the pit approach
    /// rail counts from.
    pub live_pit_in_pct: Mutex<Option<f32>>,
    /// Bitmask of active high-frequency events to emit.
    pub active_events: AtomicU32,
    /// The telemetry inspector in the settings window is open. While this is
    /// false nothing below is written at all — the inspector costs the running
    /// app exactly nothing when nobody is looking at it, which is why it pulls
    /// instead of subscribing: the settings window must never take the 60 Hz
    /// bundle again.
    pub inspector_active: AtomicBool,
    /// Last adapted frame, refreshed on the 4 Hz tier while the inspector is
    /// open. 4 Hz because that is already faster than a person can read a table
    /// of a hundred numbers.
    pub inspector_frame: Mutex<Option<SourceFrame>>,
    /// What was last put on the wire, so an unchanged frame can be held back.
    /// Lives with the connection: a reconnect clears it, because the windows
    /// have reset their stores too and need a full bundle again.
    pub publications: Mutex<Publications>,
    /// Configurable player car length in meters.
    pub car_length_m: Mutex<f32>,
    /// Set when a cached track was loaded from disk; consumed by TrackShapeProcessor
    /// on the first tick after a track_id change to skip re-recording.
    pub track_cached: Arc<std::sync::atomic::AtomicI32>,
    /// Lap time of the reference lap stored on disk for the current track+car,
    /// refreshed on every session-info update. ReferenceLapProcessor commits a
    /// new reference only when a lap beats this time, so a slower session best
    /// never overwrites a faster persisted reference.
    pub stored_reference_lap_time: Arc<Mutex<StoredReferenceTimes>>,
    /// How many distinct car classes the last computed `driver_entries` held.
    /// Recorded on every Hz10 tick, before the demand gate, so the slow slice
    /// can carry it to the main window: the hotkey runner lives there and has
    /// to know how far the standings class cycle wraps without taking the
    /// per-car frame itself.
    pub car_class_count: AtomicU32,
}

/// Bitmask flags for high-frequency events.
///
/// The frontend composes the mask from the `telemetryEvents` each widget
/// manifest declares; the names and these same bit values are mirrored in
/// `src/types/telemetry-events.ts`, and the two halves have to be changed
/// together.
pub const EVENT_CAR_DYNAMICS: u32 = 1 << 0;
pub const EVENT_CAR_INPUTS: u32 = 1 << 1;
pub const EVENT_LAP_DELTA: u32 = 1 << 2;
pub const EVENT_CAR_POSITIONS: u32 = 1 << 3;
/// The heavy per-car frames. They are computed on every due tick no matter what
/// — their processors carry state — but a frame nobody reads is left out of the
/// bundle rather than serialized, shipped to every window and remote screen,
/// parsed there and written into a store.
pub const EVENT_STANDINGS: u32 = 1 << 4;
pub const EVENT_RELATIVE: u32 = 1 << 5;
pub const EVENT_PROXIMITY: u32 = 1 << 6;

/// Compose domain-specific states.
pub struct TelemetryState {
    pub service: Arc<TelemetryServiceState>,
    /// All stateful processors. Reset on disconnect.
    pub registry: Arc<Mutex<ProcessorRegistry>>,
    /// User-configured fuel parameters.
    pub fuel_tuning: Arc<FuelTuning>,
    /// Set by reset_pit_lane_pct command; consumed by TrackShapeProcessor on next tick.
    pub reset_pit_pcts: Arc<AtomicBool>,
    /// Set by delete_reference_lap command; consumed by ReferenceLapProcessor on next tick.
    pub reset_reference_lap: Arc<AtomicBool>,
}
