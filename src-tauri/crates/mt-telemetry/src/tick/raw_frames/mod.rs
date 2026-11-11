use std::mem;

use crate::bundle::TelemetryBundle;
use crate::delivery::scheduler::DueGroups;
use crate::loop_state::LoopState;
use mt_computations::driving::input_sample::input_sample;
use mt_model::contract::telemetry_events::{
    EVENT_CAR_DYNAMICS, EVENT_CAR_INPUTS, EVENT_CAR_POSITIONS, EVENT_INPUT_SAMPLES,
};
use mt_model::sim::player::InputSample;
use mt_source::SourceFrame;

/// The most ticks a bundle carries in `input_samples`. Four covers the slowest
/// overlay clock (15 Hz over a 60 Hz source); the rest is room for a stalled
/// publication, past which the oldest ticks are dropped rather than let grow.
pub(super) const MAX_INPUT_SAMPLES: usize = 30;

pub(super) fn record_input_sample(samples: &mut Vec<InputSample>, sample: InputSample) {
    if samples.len() >= MAX_INPUT_SAMPLES {
        samples.remove(0);
    }

    samples.push(sample);
}

/// The raw 60 Hz frames, on the ticks that publish, and the input samples,
/// which are kept on every tick.
pub(super) fn collect_raw_frames(
    bundle: &mut TelemetryBundle,
    frame: &SourceFrame,
    due: DueGroups,
    active_mask: u32,
    state: &mut LoopState,
) {
    if due.publish && (active_mask & EVENT_CAR_DYNAMICS) != 0 {
        bundle.car_dynamics = Some(frame.car_dynamics.clone());
    }

    if due.publish && (active_mask & EVENT_CAR_INPUTS) != 0 {
        bundle.car_inputs = Some(frame.car_inputs.clone());
    }

    // Every tick, published or not: the trace draws each one, and a bundle
    // carries the ticks since the previous one. Nothing is kept while no trace
    // asks, so a trace switched on starts from the tick it appeared.
    if (active_mask & EVENT_INPUT_SAMPLES) != 0 {
        record_input_sample(
            &mut state.input_samples,
            input_sample(&frame.car_inputs, &frame.car_dynamics),
        );

        if due.publish {
            bundle.input_samples = Some(mem::take(&mut state.input_samples));
        }
    } else {
        state.input_samples.clear();
    }

    // Lightweight car positions for smooth map and relative rendering.
    if due.publish && (active_mask & EVENT_CAR_POSITIONS) != 0 {
        bundle.car_positions = Some(frame.car_positions.clone());
    }
}

#[cfg(test)]
mod tests;
