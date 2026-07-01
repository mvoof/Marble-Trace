pub mod fuel;
pub mod lap_delta;
pub mod lap_log;
pub mod pit_stops;
pub mod proximity;
pub mod relative;
pub mod standings;
pub mod track_shape;

use std::collections::HashMap;

use crate::capabilities::Capabilities;
use crate::model::cars::CarIdxFrame;
use crate::model::player::{CarDynamicsFrame, CarStatusFrame, LapTimingFrame};
use crate::model::session::SessionSnapshot;
use crate::model::track_shape::{TrackRecordingFrame, TrackShapePayload};

use crate::model::lap_log::LapLogFrame;
use crate::model::relative::RelativeFrame;
use fuel::{FuelComputedFrame, FuelProcessor};
use lap_delta::{LapDeltaFrame, LapDeltaProcessor};
use lap_log::LapLogProcessor;
use pit_stops::{PitStopsFrame, PitStopsProcessor};
use proximity::{ProximityFrame, ProximityProcessor};
use relative::RelativeProcessor;
use standings::{DriverEntriesFrame, StandingsProcessor};
use track_shape::TrackShapeProcessor;

/// Processor identity — reserved for diagnostics and per-processor gating (Этап 3+).
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessorId {
    Fuel,
    LapDelta,
    LapLog,
    PitStops,
    Proximity,
    Relative,
    Standings,
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
    pub car_idx: &'a CarIdxFrame,
    pub lap_timing: &'a LapTimingFrame,
    pub car_status: &'a CarStatusFrame,
    pub session: &'a SessionSnapshot,
    pub track_length_m: f32,
    pub car_length_m: f32,
    pub start_positions: &'a HashMap<i32, (i32, i32)>,
    pub pit_warning_laps: f32,
    /// `false` suppresses LapDelta output (EVENT_LAP_DELTA gate).
    pub lap_delta_active: bool,
    /// Current session number from the telemetry frame (used by fuel + pit_stops).
    pub session_num: Option<i32>,
    /// Remaining session time in seconds (used by fuel for timed races).
    pub session_time_remain: Option<f64>,
}

#[derive(Debug, Clone)]
pub enum ComputedOutput {
    Fuel(FuelComputedFrame),
    LapDelta(LapDeltaFrame),
    LapLog(LapLogFrame),
    PitStops(PitStopsFrame),
    Proximity(ProximityFrame),
    Relative(RelativeFrame),
    Standings(DriverEntriesFrame),
    TrackShape(TrackShapePayload),
    TrackRecording(TrackRecordingFrame),
    PitLanePct {
        track_id: i32,
        pit_in_pct: f32,
        pit_exit_pct: f32,
    },
}

pub trait Processor: Send {
    #[allow(dead_code)]
    fn id(&self) -> ProcessorId;
    fn required(&self) -> Capabilities;
    fn rate(&self) -> TickRate;
    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput>;
    fn reset(&mut self);
}

pub struct ProcessorRegistry {
    processors: Vec<Box<dyn Processor + Send>>,
}

impl ProcessorRegistry {
    pub fn new(
        force_track_start: std::sync::Arc<std::sync::atomic::AtomicBool>,
        reset_pit_pcts: std::sync::Arc<std::sync::atomic::AtomicBool>,
        track_cached: std::sync::Arc<std::sync::atomic::AtomicI32>,
        reset_track_shape: std::sync::Arc<std::sync::atomic::AtomicBool>,
    ) -> Self {
        Self {
            processors: vec![
                Box::new(FuelProcessor::default()),
                Box::new(LapDeltaProcessor::default()),
                Box::new(LapLogProcessor::default()),
                Box::new(PitStopsProcessor::default()),
                Box::new(ProximityProcessor),
                Box::new(RelativeProcessor::default()),
                Box::new(StandingsProcessor::default()),
                Box::new(TrackShapeProcessor::new(
                    force_track_start,
                    reset_pit_pcts,
                    track_cached,
                    reset_track_shape,
                )),
            ],
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
