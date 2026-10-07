pub mod car_speed;
pub mod coach;
pub mod driver_entries;
pub mod fuel;
pub mod incidents;
pub mod lap_delta;
pub mod lap_log;
pub mod lap_time_settle;
pub mod pace_car;
pub mod pit_actions;
pub mod pit_auto;
pub mod pit_stops;
pub mod pit_target;
pub mod proximity;
pub mod reference_lap;
pub mod reference_selection;
pub mod relative;
pub mod track_shape;

use std::collections::HashMap;
use std::sync::Arc;

use crate::capabilities::Capabilities;
use crate::model::cars::CarIdxFrame;
use crate::model::enums::SessionState;
use crate::model::environment::EnvironmentFrame;
use crate::model::player::{
    CarDynamicsFrame, CarInputsFrame, CarStatusFrame, ChassisFrame, LapTimingFrame, PitServiceFrame,
};
use crate::model::session::SessionSnapshot;
use crate::model::track_shape::{TrackRecordingFrame, TrackShapePayload};

use crate::model::lap_log::LapLogFrame;
use crate::model::reference_lap::{ReferenceLapData, StoredReferenceTimes};
use crate::model::relative::RelativeFrame;
use coach::{CoachFrame, CoachProcessor};
use driver_entries::{DriverEntriesFrame, DriverEntriesProcessor};
use fuel::{FuelComputedFrame, FuelProcessor};
use incidents::{IncidentsFrame, IncidentsProcessor};
use lap_delta::{LapDeltaFrame, LapDeltaProcessor};
use lap_log::LapLogProcessor;
use pace_car::{PaceCarFrame, PaceCarProcessor};
use pit_stops::{PitStopsFrame, PitStopsProcessor};
use proximity::{ProximityFrame, ProximityProcessor};
use reference_lap::ReferenceLapProcessor;
use relative::RelativeProcessor;
use track_shape::TrackShapeProcessor;

/// Processor identity — reserved for diagnostics and per-processor gating (Этап 3+).
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessorId {
    Coach,
    Fuel,
    LapDelta,
    LapLog,
    PaceCar,
    PitStops,
    Proximity,
    Incidents,
    ReferenceLap,
    Relative,
    DriverEntries,
    TrackShape,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TickRate {
    Hz60,
    Hz10,
    Hz4,
    /// No 1 Hz processors yet; the tier exists for future sims/processors.
    #[allow(dead_code)]
    Hz1,
}

/// All data a processor needs for one tick. Fields mirror the union of
/// arguments from all five free `compute(...)` functions.
pub struct ComputeContext<'a> {
    pub car_dynamics: &'a CarDynamicsFrame,
    pub car_inputs: &'a CarInputsFrame,
    pub car_idx: &'a CarIdxFrame,
    pub lap_timing: &'a LapTimingFrame,
    pub car_status: &'a CarStatusFrame,
    pub pit_service: &'a PitServiceFrame,
    pub chassis: &'a ChassisFrame,
    pub environment: &'a EnvironmentFrame,
    pub session: &'a SessionSnapshot,
    pub track_length_m: f32,
    pub car_length_m: f32,
    pub start_positions: &'a HashMap<i32, (i32, i32)>,
    pub fuel_settings: fuel::FuelSettings,
    /// `false` suppresses LapDelta output (EVENT_LAP_DELTA gate).
    pub lap_delta_active: bool,
    /// Current session number from the telemetry frame (used by fuel + pit_stops).
    pub session_num: Option<i32>,
    /// Seconds since the session started — the clock `CarSpeedTracker` derives
    /// every car's speed against, so a paused sim reads as nobody moving.
    pub session_time: Option<f64>,
    /// Remaining session time in seconds (used by fuel for timed races).
    pub session_time_remain: Option<f64>,
    /// Session state from the telemetry frame (used by driver entries to latch finishers).
    pub session_state: Option<SessionState>,
}

#[derive(Debug, Clone)]
pub enum ComputedOutput {
    Coach(CoachFrame),
    Fuel(FuelComputedFrame),
    LapDelta(LapDeltaFrame),
    LapLog(LapLogFrame),
    PaceCar(PaceCarFrame),
    PitStops(PitStopsFrame),
    Proximity(ProximityFrame),
    Incidents(IncidentsFrame),
    ReferenceLap(ReferenceLapData),
    Relative(RelativeFrame),
    DriverEntries(DriverEntriesFrame),
    TrackShape(TrackShapePayload),
    TrackRecording(TrackRecordingFrame),
    PitLanePct {
        track_id: i32,
        pit_in_pct: f32,
        pit_exit_pct: f32,
    },
}

/// Something outside the tick tells a processor: a user action, or what the
/// runtime learned from disk alongside a session. Handed to every processor
/// before the tick it applies to; each one ignores what is not about it.
#[derive(Debug, Clone)]
pub enum ProcessorCommand {
    /// Start recording the track shape from where the car is, not from the line.
    ForceTrackStart,
    /// The user cleared the current track's recorded shape.
    ClearTrackShape,
    /// The user asked to recalibrate the pit lane markers.
    ResetPitLane,
    /// A shape for this track id was loaded from disk, so it is not recorded again.
    TrackCached(i32),
    /// The lap times of the references stored for the session's track and car.
    StoredReferenceTimes(StoredReferenceTimes),
    /// The stored reference was deleted; record a new one from the next lap.
    ResetReferenceLap,
    /// The reference lap the coach compares against changed, or there is none.
    ActiveReference(Option<Arc<ReferenceLapData>>),
}

pub trait Processor: Send {
    #[allow(dead_code)]
    fn id(&self) -> ProcessorId;
    fn required(&self) -> Capabilities;
    fn rate(&self) -> TickRate;
    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput>;
    fn reset(&mut self);
    fn command(&mut self, _command: &ProcessorCommand) {}
}

pub struct ProcessorRegistry {
    processors: Vec<Box<dyn Processor + Send>>,
}

impl Default for ProcessorRegistry {
    fn default() -> Self {
        Self {
            processors: vec![
                Box::new(CoachProcessor::default()),
                Box::new(FuelProcessor::default()),
                Box::new(LapDeltaProcessor::default()),
                Box::new(LapLogProcessor::default()),
                Box::new(PaceCarProcessor::default()),
                Box::new(PitStopsProcessor::default()),
                Box::new(ProximityProcessor),
                Box::new(IncidentsProcessor::default()),
                Box::new(ReferenceLapProcessor::default()),
                Box::new(RelativeProcessor::default()),
                Box::new(DriverEntriesProcessor::default()),
                Box::new(TrackShapeProcessor::default()),
            ],
        }
    }
}

impl ProcessorRegistry {
    pub fn command(&mut self, command: ProcessorCommand) {
        for processor in &mut self.processors {
            processor.command(&command);
        }
    }

    pub fn reset_all(&mut self) {
        for processor in &mut self.processors {
            processor.reset();
        }
    }

    /// Run all processors whose rate matches `rate` and whose required capabilities
    /// are a subset of `capabilities`. Returns one `ComputedOutput` per processor
    /// that produces a result.
    pub fn run(
        &mut self,
        rate: TickRate,
        capabilities: Capabilities,
        ctx: &ComputeContext,
    ) -> Vec<ComputedOutput> {
        let mut outputs = Vec::new();

        for processor in &mut self.processors {
            if processor.rate() != rate {
                continue;
            }

            if !capabilities.contains(processor.required()) {
                continue;
            }

            if let Some(output) = processor.compute(ctx) {
                outputs.push(output);
            }
        }

        outputs
    }
}

/// Temporary shim so existing tests in sub-modules that call
/// `lap_delta::compute(..., &Mutex<LapDeltaState>)` continue to compile.
/// The free functions remain unchanged; processors wrap them.
#[allow(dead_code)]
fn _assert_send()
where
    ProcessorRegistry: Send,
{
}

/// Registers the computed frames this layer publishes.
#[cfg(feature = "dev")]
pub fn register_types(types: &mut specta::TypeCollection) {
    types
        .register::<coach::CoachCall>()
        .register::<coach::CoachFrame>()
        .register::<coach::CoachInactiveReason>()
        .register::<coach::DrivingAdvisory>()
        .register::<driver_entries::DriverEntriesFrame>()
        .register::<driver_entries::DriverEntry>()
        .register::<fuel::FuelComputedFrame>()
        .register::<incidents::IncidentKind>()
        .register::<incidents::IncidentPoint>()
        .register::<incidents::IncidentsFrame>()
        .register::<lap_delta::LapDeltaFrame>()
        .register::<pace_car::PaceCarFrame>()
        .register::<pace_car::PaceCarPitPhase>()
        .register::<pace_car::PaceCarState>()
        .register::<pit_stops::PitStopsFrame>()
        .register::<proximity::LateralSide>()
        .register::<proximity::NearbyCar>()
        .register::<proximity::ProximityFrame>()
        .register::<proximity::RadarDistances>();
}
