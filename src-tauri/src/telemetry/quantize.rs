//! Rounding applied to the bundle immediately before it is published.
//!
//! Raw simulator floats carry far more precision than any widget draws:
//! `car_idx_lap_dist_pct` moves in its seventh decimal on a car standing still
//! in the pit box, and every one of those wiggles is a value serialized, shipped
//! to every window and remote screen, parsed there and written into a store that
//! then wakes its observers — to redraw a pixel that did not move.
//!
//! Rounding here buys two things. The payload shrinks, because
//! `0.4312487840652466` becomes `0.4312`. And, far more importantly, a frame
//! that is *visually* unchanged becomes *literally* unchanged, so
//! [`Publications::take_if_changed`] can drop it from the bundle entirely.
//!
//! Two rules govern what may be rounded here:
//!
//! 1. **Publication only.** The processors upstream see the raw values; nothing
//!    in `computations/` ever reads a rounded number. Rounding an input to a
//!    processor that integrates over time (fuel projection, lap delta, anything
//!    differencing consecutive frames) would let the error compound.
//! 2. **A decimal place in reserve.** Every precision below is at least one
//!    decimal finer than the widget that draws it — gaps print as `toFixed(1)`
//!    and are rounded to 2 dp, positions drive a map at ~0.5 m and are rounded
//!    to 4 dp.
//!
//! `car_dynamics` and `car_inputs` are deliberately left alone: they are single
//! small structs, they change genuinely on every tick while driving, so there is
//! nothing to save — and they feed the smoothing in the coach and the input
//! trace.

use crate::computations::driver_entries::{DriverEntriesFrame, DriverEntry};
use crate::computations::proximity::ProximityFrame;
use crate::model::cars::{CarIdxFrame, CarPositionsFrame};
use crate::model::player::PitTargetFrame;
use crate::model::relative::RelativeFrame;

/// Position around the lap, 0..1. 4 dp is 0.01 % of a lap — about 0.5 m on a
/// 5 km track, well under a pixel on any rendered map.
const POSITION_DP: u32 = 4;
/// Gaps and estimated lap times, in seconds. Displayed as `toFixed(1)`, so 2 dp
/// leaves a factor of ten in hand.
const GAP_DP: u32 = 2;
/// Lap times, in seconds. Displayed to the thousandth, which is also the
/// smallest unit the sim itself reports meaningfully.
const LAP_TIME_DP: u32 = 3;
/// Distances between cars, in meters. 2 dp is a centimeter.
const DISTANCE_DP: u32 = 2;

fn round(value: f32, decimals: u32) -> f32 {
    let factor = 10f32.powi(decimals as i32);
    let scaled = value * factor;

    // Leave anything the arithmetic cannot represent exactly as it is rather
    // than turning it into a different non-finite value.
    if !scaled.is_finite() {
        return value;
    }

    scaled.round() / factor
}

fn round_all(values: &mut [f32], decimals: u32) {
    for value in values.iter_mut() {
        *value = round(*value, decimals);
    }
}

fn round_opt(value: &mut Option<f32>, decimals: u32) {
    if let Some(inner) = value.as_mut() {
        *inner = round(*inner, decimals);
    }
}

/// The pit rail draws the distance to the metre, and the lane progress as a bar
/// a few hundred pixels wide — but the bar is one *leg* of the lane, so a
/// hundredth of the lane is several pixels of step and the fill visibly ticks
/// along instead of sliding. Progress is rounded like every other lap position
/// instead, which is a decimal finer than the widest rail can show.
///
/// Not held back by `Publications` like the per-car frames are: here an absent
/// frame means *no target* — the car is nowhere near the pits — and the overlay
/// has to clear the rail when it stops arriving. Rounding still earns its keep,
/// because the frontend unpacks the frame into plain observables and MobX wakes
/// no observer for a value that did not change.
pub fn pit_target(frame: &mut PitTargetFrame) {
    frame.dist_m = round(frame.dist_m, DISTANCE_DP);
    frame.lane_progress_pct = round(frame.lane_progress_pct, POSITION_DP);
}

pub fn car_positions(frame: &mut CarPositionsFrame) {
    round_all(&mut frame.car_idx_lap_dist_pct, POSITION_DP);
}

pub fn car_idx(frame: &mut CarIdxFrame) {
    round_all(&mut frame.car_idx_lap_dist_pct, POSITION_DP);
    round_all(&mut frame.car_idx_est_time, GAP_DP);
    round_all(&mut frame.car_idx_f2_time, GAP_DP);
    round_all(&mut frame.car_idx_last_lap_time, LAP_TIME_DP);
    round_all(&mut frame.car_idx_best_lap_time, LAP_TIME_DP);
}

fn driver_entry(entry: &mut DriverEntry) {
    entry.lap_dist_pct = round(entry.lap_dist_pct, POSITION_DP);
    entry.relative_lap_dist = round(entry.relative_lap_dist, POSITION_DP);
    entry.est_time = round(entry.est_time, GAP_DP);
    entry.f2_time = round(entry.f2_time, GAP_DP);
    entry.last_lap_time = round(entry.last_lap_time, LAP_TIME_DP);
    entry.best_lap_time = round(entry.best_lap_time, LAP_TIME_DP);
    entry.qualify_time = round(entry.qualify_time, LAP_TIME_DP);
    entry.class_est_lap_time = round(entry.class_est_lap_time, LAP_TIME_DP);
    round_opt(&mut entry.results_position_time, LAP_TIME_DP);
}

pub fn driver_entries(frame: &mut DriverEntriesFrame) {
    for entry in frame.entries.iter_mut() {
        driver_entry(entry);
    }
}

pub fn relative(frame: &mut RelativeFrame) {
    for entry in frame.entries.iter_mut() {
        driver_entry(entry);
    }
}

pub fn proximity(frame: &mut ProximityFrame) {
    for car in frame.nearby_cars.iter_mut() {
        car.longitudinal_dist = round(car.longitudinal_dist, DISTANCE_DP);
        car.clearance = round(car.clearance, DISTANCE_DP);
        car.bumper_dist = round(car.bumper_dist, DISTANCE_DP);
    }

    frame.radar_distances.front_dist = round(frame.radar_distances.front_dist, DISTANCE_DP);
    frame.radar_distances.rear_dist = round(frame.radar_distances.rear_dist, DISTANCE_DP);
    round_opt(&mut frame.radar_distances.left_dist, DISTANCE_DP);
    round_opt(&mut frame.radar_distances.right_dist, DISTANCE_DP);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rounds_to_the_requested_decimal() {
        assert_eq!(round(0.431_248_8, 4), 0.4312);
        assert_eq!(round(-1.234_5, 2), -1.23);
        assert_eq!(round(12.345_6, 3), 12.346);
    }

    #[test]
    fn leaves_non_finite_values_alone() {
        assert!(round(f32::NAN, 4).is_nan());
        assert_eq!(round(f32::INFINITY, 4), f32::INFINITY);
    }

    #[test]
    fn collapses_sub_precision_jitter_to_one_value() {
        // The whole point: two raw values a widget could never tell apart have
        // to become the same number, or nothing downstream can skip them.
        assert_eq!(round(0.500_000_1, 4), round(0.500_000_9, 4));
    }

    #[test]
    fn keeps_a_difference_the_display_would_show() {
        // A tenth of a second is what the gap columns print; two values that far
        // apart must survive rounding as two values.
        assert_ne!(round(1.10, GAP_DP), round(1.20, GAP_DP));
    }
}
