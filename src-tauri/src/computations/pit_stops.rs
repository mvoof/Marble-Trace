use std::sync::atomic::{AtomicBool, AtomicI32, AtomicU32, Ordering};

use crate::capabilities::Capabilities;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use serde::{Deserialize, Serialize};

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PitStopsFrame {
    pub player_stops: u32,
}

/// Shared state for pit stop tracking.
pub struct PitStopState {
    /// Player pit stop counter for the current session.
    pub count: AtomicU32,
    /// Whether the player was on pit road on the previous frame.
    pub was_on_pit_road: AtomicBool,
    /// Session number tracked for pit stop reset.
    pub tracked_session_num: AtomicI32,
}

impl Default for PitStopState {
    fn default() -> Self {
        Self {
            count: AtomicU32::new(0),
            was_on_pit_road: AtomicBool::new(false),
            tracked_session_num: AtomicI32::new(-1),
        }
    }
}

/// Stateful processor wrapping the pit-stop counter.
#[derive(Default)]
pub struct PitStopsProcessor {
    state: PitStopState,
}

impl Processor for PitStopsProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::PitStops
    }

    fn required(&self) -> Capabilities {
        Capabilities::empty()
    }

    fn rate(&self) -> TickRate {
        TickRate::Hz4
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        let on_pit_road = ctx.car_status.on_pit_road?;
        let frame = compute(ctx.session_num, on_pit_road, &self.state)?;

        Some(ComputedOutput::PitStops(frame))
    }

    fn reset(&mut self) {
        self.state.count.store(0, Ordering::Relaxed);
        self.state.was_on_pit_road.store(false, Ordering::Relaxed);
        self.state.tracked_session_num.store(-1, Ordering::Relaxed);
    }
}

pub fn compute(
    session_num: Option<i32>,
    on_pit_road: bool,
    state: &PitStopState,
) -> Option<PitStopsFrame> {
    let current_session_num = session_num.unwrap_or(-1);
    let tracked_session = state.tracked_session_num.load(Ordering::Relaxed);

    if current_session_num != tracked_session {
        state
            .tracked_session_num
            .store(current_session_num, Ordering::Relaxed);
        state.count.store(0, Ordering::Relaxed);
        state.was_on_pit_road.store(false, Ordering::Relaxed);
    }

    let was = state.was_on_pit_road.load(Ordering::Relaxed);

    if on_pit_road && !was {
        state.count.fetch_add(1, Ordering::Relaxed);
    }

    state.was_on_pit_road.store(on_pit_road, Ordering::Relaxed);

    let stops = state.count.load(Ordering::Relaxed);

    Some(PitStopsFrame {
        player_stops: stops,
    })
}
