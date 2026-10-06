//! Where each pace car is relative to the pits.
//!
//! The sim reports a surface per car, not an intention: `AproachingPits` covers
//! the whole pit lane in both directions, and the pace car is placed rather
//! than driven, so it can sit in its box reporting `OnTrack`. Telling entry from
//! exit, and a parked car from one rolling down the lane, takes history — the
//! previous phase and how long the car has stood still — which is why this
//! runs here, once, instead of in every window that draws a pace car (a window
//! opened mid-session had no history and had to guess).

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::capabilities::Capabilities;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use crate::model::enums::TrackSurface;

/// How long the lap distance may stand still before a car on pit road counts as
/// parked. A car rolling slowly down the pit lane can repeat a position for a
/// tick or two, so stillness has to hold for a while before it means anything.
const PARKED_AFTER_S: f64 = 2.0;

/// Lap distance is compared at the precision the windows receive it (4 dp,
/// `telemetry/quantize.rs`): the raw float of a car sitting still can still
/// jitter in its last bits, and that must not read as movement.
const LAP_DIST_STEPS: f32 = 10_000.0;

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum PaceCarPitPhase {
    /// Not in the world, or no reading yet — "not on track" everywhere it gates drawing.
    #[default]
    Unknown,
    OnTrack,
    Stall,
    PitIn,
    PitOut,
    Parked,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PaceCarState {
    pub car_idx: i32,
    pub phase: PaceCarPitPhase,
}

/// Every pace car in the session roster, with its phase. Empty when the session
/// has none, so a window never keeps one from the previous session.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PaceCarFrame {
    pub cars: Vec<PaceCarState>,
}

/// One step of the phase machine.
///
/// `NotInWorld` is not a location but the absence of one — the pace car spends
/// most of a session there. Carrying the previous phase across it is what made
/// the phase stick (a car removed after leaving the pits stayed `PitOut`
/// forever), so it resets to `Unknown`.
///
/// Leaving the stall does not mean leaving the pits: the pace car is moved from
/// its box to a parking spot on the pit lane and sits there, still reporting
/// `AproachingPits`. A car standing still on pit road is therefore `Parked`, and
/// counts as having come from a stop once it moves again.
pub fn next_phase(
    surface: TrackSurface,
    previous: PaceCarPitPhase,
    on_pit_road: bool,
    stationary: bool,
) -> PaceCarPitPhase {
    let in_pit_lane = surface == TrackSurface::AproachingPits
        || (on_pit_road && surface == TrackSurface::OnTrack);

    if in_pit_lane && stationary {
        return PaceCarPitPhase::Parked;
    }

    let came_from_stop = matches!(
        previous,
        PaceCarPitPhase::Stall | PaceCarPitPhase::PitOut | PaceCarPitPhase::Parked
    );
    let pit_lane_phase = if came_from_stop {
        PaceCarPitPhase::PitOut
    } else {
        PaceCarPitPhase::PitIn
    };

    // The pit-road flag is set whatever the surface says, so it overrules an
    // on-track reading rather than being merged into one: a placed car parked in
    // its box can report `OnTrack`.
    if on_pit_road && surface == TrackSurface::OnTrack {
        return pit_lane_phase;
    }

    match surface {
        TrackSurface::NotInWorld => PaceCarPitPhase::Unknown,
        TrackSurface::InPitStall => PaceCarPitPhase::Stall,
        TrackSurface::OnTrack => PaceCarPitPhase::OnTrack,
        // With no trustworthy previous phase there is no telling entry from
        // exit, so it is read as entry: the conservative half, which stays
        // hidden until a real on-track reading arrives.
        TrackSurface::AproachingPits => pit_lane_phase,
        TrackSurface::OffTrack => previous,
    }
}

struct Motion {
    lap_dist_step: i32,
    moved_at_s: f64,
}

#[derive(Default)]
pub struct PaceCarProcessor {
    phases: HashMap<i32, PaceCarPitPhase>,
    motion: HashMap<i32, Motion>,
}

impl PaceCarProcessor {
    /// Whether the car has held its lap distance for `PARKED_AFTER_S`.
    fn is_stationary(&mut self, car_idx: i32, lap_dist_pct: f32, now_s: f64) -> bool {
        let lap_dist_step = (lap_dist_pct * LAP_DIST_STEPS).round() as i32;

        match self.motion.get(&car_idx) {
            Some(motion) if motion.lap_dist_step == lap_dist_step => {
                now_s - motion.moved_at_s >= PARKED_AFTER_S
            }
            _ => {
                self.motion.insert(
                    car_idx,
                    Motion {
                        lap_dist_step,
                        moved_at_s: now_s,
                    },
                );

                false
            }
        }
    }

    /// Advances every pace car by one reading and returns the frame.
    pub fn step(
        &mut self,
        pace_car_idxs: &[i32],
        surface_of: impl Fn(usize) -> TrackSurface,
        on_pit_road_of: impl Fn(usize) -> bool,
        lap_dist_of: impl Fn(usize) -> f32,
        now_s: f64,
    ) -> PaceCarFrame {
        let mut cars = Vec::with_capacity(pace_car_idxs.len());

        for &car_idx in pace_car_idxs {
            let Ok(slot) = usize::try_from(car_idx) else {
                continue;
            };

            let stationary = self.is_stationary(car_idx, lap_dist_of(slot), now_s);
            let previous = self.phases.get(&car_idx).copied().unwrap_or_default();
            let phase = next_phase(surface_of(slot), previous, on_pit_road_of(slot), stationary);

            self.phases.insert(car_idx, phase);
            cars.push(PaceCarState { car_idx, phase });
        }

        PaceCarFrame { cars }
    }
}

impl Processor for PaceCarProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::PaceCar
    }

    fn required(&self) -> Capabilities {
        Capabilities::empty()
    }

    fn rate(&self) -> TickRate {
        TickRate::Hz10
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        let pace_car_idxs: Vec<i32> = ctx
            .session
            .cars
            .iter()
            .filter(|car| car.is_pace_car)
            .map(|car| car.car_idx)
            .collect();
        let car_idx = ctx.car_idx;
        // The session clock stops with the sim, so a paused session does not
        // turn a pace car rolling down the lane into a parked one.
        let now_s = ctx.session_time.unwrap_or(0.0);

        let frame = self.step(
            &pace_car_idxs,
            |slot| {
                car_idx
                    .car_idx_track_surface
                    .get(slot)
                    .copied()
                    .unwrap_or_default()
            },
            |slot| {
                car_idx
                    .car_idx_on_pit_road
                    .get(slot)
                    .copied()
                    .unwrap_or(false)
            },
            |slot| {
                car_idx
                    .car_idx_lap_dist_pct
                    .get(slot)
                    .copied()
                    .unwrap_or(-1.0)
            },
            now_s,
        );

        Some(ComputedOutput::PaceCar(frame))
    }

    fn reset(&mut self) {
        self.phases.clear();
        self.motion.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use PaceCarPitPhase::{OnTrack, Parked, PitIn, PitOut, Stall, Unknown};
    use TrackSurface::{AproachingPits, InPitStall, NotInWorld, OffTrack};

    const ON_TRACK: TrackSurface = TrackSurface::OnTrack;

    #[test]
    fn reads_the_unambiguous_surfaces_without_the_previous_phase() {
        assert_eq!(next_phase(InPitStall, OnTrack, false, false), Stall);
        assert_eq!(next_phase(ON_TRACK, Stall, false, false), OnTrack);
    }

    #[test]
    fn tells_pit_entry_from_pit_exit_by_where_the_car_came_from() {
        assert_eq!(next_phase(AproachingPits, OnTrack, false, false), PitIn);
        assert_eq!(next_phase(AproachingPits, Stall, false, false), PitOut);
        assert_eq!(next_phase(AproachingPits, PitOut, false, false), PitOut);
    }

    #[test]
    fn assumes_pit_entry_without_a_trustworthy_previous_phase() {
        assert_eq!(next_phase(AproachingPits, Unknown, false, false), PitIn);
    }

    #[test]
    fn drops_to_unknown_when_the_car_leaves_the_world() {
        assert_eq!(next_phase(NotInWorld, OnTrack, false, false), Unknown);
        assert_eq!(next_phase(NotInWorld, PitOut, false, false), Unknown);
    }

    #[test]
    fn keeps_the_phase_across_an_off_track_reading() {
        assert_eq!(next_phase(OffTrack, OnTrack, false, false), OnTrack);
        assert_eq!(next_phase(OffTrack, Stall, false, false), Stall);
    }

    #[test]
    fn trusts_the_pit_road_flag_over_an_on_track_surface() {
        assert_eq!(next_phase(ON_TRACK, Unknown, true, false), PitIn);
        assert_eq!(next_phase(ON_TRACK, Stall, true, false), PitOut);
    }

    #[test]
    fn reads_a_clean_on_track_surface_as_on_track_once_the_flag_clears() {
        assert_eq!(next_phase(ON_TRACK, PitOut, false, false), OnTrack);
    }

    #[test]
    fn never_resurrects_a_pit_out_phase_after_the_car_is_removed() {
        let mut phase = next_phase(InPitStall, Unknown, false, false);
        phase = next_phase(AproachingPits, phase, false, false);
        assert_eq!(phase, PitOut);

        phase = next_phase(NotInWorld, phase, false, false);
        assert_eq!(phase, Unknown);
    }

    #[test]
    fn reads_a_car_standing_still_in_the_pit_lane_as_parked() {
        assert_eq!(next_phase(AproachingPits, PitOut, false, true), Parked);
        assert_eq!(next_phase(AproachingPits, Unknown, false, true), Parked);
        assert_eq!(next_phase(ON_TRACK, Stall, true, true), Parked);
    }

    #[test]
    fn does_not_hold_a_pit_exit_open_while_the_car_is_parked_after_its_stall() {
        let mut phase = next_phase(InPitStall, Unknown, false, false);
        phase = next_phase(AproachingPits, phase, false, false);
        assert_eq!(phase, PitOut);

        phase = next_phase(AproachingPits, phase, false, true);
        assert_eq!(phase, Parked);

        phase = next_phase(AproachingPits, phase, false, true);
        assert_eq!(phase, Parked);
    }

    #[test]
    fn reads_a_parked_car_that_moves_off_as_leaving_the_pits() {
        assert_eq!(next_phase(AproachingPits, Parked, false, false), PitOut);
        assert_eq!(next_phase(ON_TRACK, Parked, true, false), PitOut);
    }

    #[test]
    fn never_parks_a_car_standing_on_the_track_itself() {
        assert_eq!(next_phase(ON_TRACK, OnTrack, false, true), OnTrack);
        assert_eq!(next_phase(InPitStall, PitIn, false, true), Stall);
    }

    const PACE_CAR: i32 = 2;

    fn step_at(
        processor: &mut PaceCarProcessor,
        surface: TrackSurface,
        lap_dist: f32,
        now_s: f64,
    ) -> PaceCarPitPhase {
        processor
            .step(&[PACE_CAR], |_| surface, |_| false, |_| lap_dist, now_s)
            .cars[0]
            .phase
    }

    #[test]
    fn a_car_still_in_the_lane_parks_only_after_the_hold() {
        let mut processor = PaceCarProcessor::default();

        assert_eq!(step_at(&mut processor, InPitStall, 0.1, 0.0), Stall);
        assert_eq!(step_at(&mut processor, AproachingPits, 0.11, 1.0), PitOut);
        assert_eq!(step_at(&mut processor, AproachingPits, 0.11, 2.5), PitOut);
        assert_eq!(step_at(&mut processor, AproachingPits, 0.11, 3.0), Parked);
    }

    #[test]
    fn jitter_below_the_published_precision_is_not_movement() {
        let mut processor = PaceCarProcessor::default();

        step_at(&mut processor, AproachingPits, 0.250_01, 0.0);

        assert_eq!(
            step_at(&mut processor, AproachingPits, 0.250_02, 2.0),
            Parked
        );
    }

    #[test]
    fn moving_restarts_the_hold() {
        let mut processor = PaceCarProcessor::default();

        step_at(&mut processor, AproachingPits, 0.2, 0.0);
        step_at(&mut processor, AproachingPits, 0.21, 1.5);

        assert_eq!(step_at(&mut processor, AproachingPits, 0.21, 3.0), PitIn);
        assert_eq!(step_at(&mut processor, AproachingPits, 0.21, 3.5), Parked);
    }

    #[test]
    fn reset_forgets_the_history() {
        let mut processor = PaceCarProcessor::default();

        step_at(&mut processor, InPitStall, 0.1, 0.0);
        processor.reset();

        assert_eq!(step_at(&mut processor, AproachingPits, 0.2, 1.0), PitIn);
    }

    #[test]
    fn publishes_every_roster_pace_car_and_nothing_else() {
        let mut processor = PaceCarProcessor::default();

        let frame = processor.step(&[3, 7], |_| ON_TRACK, |_| false, |_| 0.5, 0.0);

        assert_eq!(
            frame.cars,
            vec![
                PaceCarState {
                    car_idx: 3,
                    phase: OnTrack
                },
                PaceCarState {
                    car_idx: 7,
                    phase: OnTrack
                },
            ]
        );
        assert!(processor
            .step(&[], |_| ON_TRACK, |_| false, |_| 0.5, 0.0)
            .cars
            .is_empty());
    }
}
