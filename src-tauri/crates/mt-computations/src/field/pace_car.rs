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

use crate::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use mt_model::contract::capabilities::Capabilities;
use mt_model::sim::cars::{PaceFormation, PacingFrame};
use mt_model::sim::enums::{SessionState, TrackSurface};
use mt_model::sim::flags::{CAUTION, CAUTION_WAVING};

/// How long the lap distance may stand still before a car on pit road counts as
/// parked. A car rolling slowly down the pit lane can repeat a position for a
/// tick or two, so stillness has to hold for a while before it means anything.
const PARKED_AFTER_S: f64 = 2.0;

/// Lap distance is compared at the precision the windows receive it (4 dp,
/// `mt-telemetry/src/delivery/quantize.rs`): the raw float of a car sitting still can still
/// jitter in its last bits, and that must not read as movement.
const LAP_DIST_STEPS: f32 = 10_000.0;

const CAUTION_BITS: u32 = CAUTION | CAUTION_WAVING;

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

/// How still a car is, from its lap distance over time.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Stillness {
    /// The lap distance changed on this reading.
    Moving,
    /// The lap distance holds, but not yet for `PARKED_AFTER_S`.
    Settling,
    /// The lap distance has held for `PARKED_AFTER_S`.
    Stationary,
}

/// Whether the field is lined up behind the pace car. `PaceMode` alone does
/// not say so: it kept reporting a double-file start for the whole race at
/// Zolder (tape, 2026-11-02), while every car's pace line dropped to -1 within
/// seconds of the green.
pub fn field_lined_up(pacing: &PacingFrame) -> bool {
    pacing.formation != PaceFormation::NotPacing
        && pacing.car_idx_pace_line.iter().any(|&line| line >= 0)
}

/// Whether the pace car may legitimately stand still on the circuit: before
/// the start (ahead of the grid), with the field lined up behind it, or under
/// a caution. Only a green racing session — or what follows it — with none of
/// those rules it out. An unknown session state counts as expected, the side
/// that never hides a car that is really out there.
pub fn expected_on_track(
    lined_up: bool,
    session_state: Option<SessionState>,
    session_flags: Option<u32>,
) -> bool {
    let caution = session_flags.is_some_and(|flags| flags & CAUTION_BITS != 0);
    let past_the_start = matches!(
        session_state,
        Some(SessionState::Racing | SessionState::Checkered | SessionState::CoolDown)
    );

    lined_up || caution || !past_the_start
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
///
/// At some tracks the parking spot lies outside the pit-road zone and reports
/// `OnTrack`. A still car there is `Parked` only when the pace car is not
/// `expected_on_track`. While it may be out there — before the start, with the
/// field lined up, under a caution — a still `OnTrack` car is a pace car
/// waiting on the circuit, whatever it did before, so it is drawn and lights
/// the pace-car flag. Under a caution it can stop just past the pit exit, and
/// that must not read as parked.
pub fn next_phase(
    surface: TrackSurface,
    previous: PaceCarPitPhase,
    on_pit_road: bool,
    stillness: Stillness,
    expected_on_track: bool,
) -> PaceCarPitPhase {
    let stationary = stillness == Stillness::Stationary;
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

    if surface == TrackSurface::OnTrack && !expected_on_track && stillness != Stillness::Moving {
        if stationary {
            return PaceCarPitPhase::Parked;
        }

        // Until the hold is over a car from the pit lane keeps whichever phase
        // it had there, the stall included, so it is not drawn out on circuit
        // for the two seconds it takes to call it parked.
        let came_from_pit_lane = came_from_stop || previous == PaceCarPitPhase::PitIn;

        if came_from_pit_lane {
            return previous;
        }
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
    /// How long the car has held its lap distance, against `PARKED_AFTER_S`.
    fn stillness(&mut self, car_idx: i32, lap_dist_pct: f32, now_s: f64) -> Stillness {
        let lap_dist_step = (lap_dist_pct * LAP_DIST_STEPS).round() as i32;

        match self.motion.get(&car_idx) {
            Some(motion) if motion.lap_dist_step == lap_dist_step => {
                if now_s - motion.moved_at_s >= PARKED_AFTER_S {
                    Stillness::Stationary
                } else {
                    Stillness::Settling
                }
            }
            _ => {
                self.motion.insert(
                    car_idx,
                    Motion {
                        lap_dist_step,
                        moved_at_s: now_s,
                    },
                );

                Stillness::Moving
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
        expected_on_track: bool,
        now_s: f64,
    ) -> PaceCarFrame {
        let mut cars = Vec::with_capacity(pace_car_idxs.len());

        for &car_idx in pace_car_idxs {
            let Ok(slot) = usize::try_from(car_idx) else {
                continue;
            };

            let stillness = self.stillness(car_idx, lap_dist_of(slot), now_s);
            let previous = self.phases.get(&car_idx).copied().unwrap_or_default();
            let phase = next_phase(
                surface_of(slot),
                previous,
                on_pit_road_of(slot),
                stillness,
                expected_on_track,
            );

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
        let pace_car_idxs = ctx.session.pace_car_idxs();
        let car_idx = ctx.car_idx;
        // The session clock stops with the sim, so a paused session does not
        // turn a pace car rolling down the lane into a parked one.
        let now_s = ctx.session_time.unwrap_or(0.0);
        let expected = expected_on_track(
            field_lined_up(ctx.pacing),
            ctx.session_state,
            ctx.session_flags,
        );

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
            expected,
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
    use Stillness::{Moving, Settling, Stationary};
    use TrackSurface::{AproachingPits, InPitStall, NotInWorld, OffTrack};

    const ON_TRACK: TrackSurface = TrackSurface::OnTrack;
    const EXPECTED: bool = true;
    const NOT_EXPECTED: bool = false;
    const LINED_UP: bool = true;
    const NOT_LINED_UP: bool = false;

    /// A reading where the context does not rule the pace car off the circuit.
    fn phase_of(
        surface: TrackSurface,
        previous: PaceCarPitPhase,
        on_pit_road: bool,
        stillness: Stillness,
    ) -> PaceCarPitPhase {
        next_phase(surface, previous, on_pit_road, stillness, EXPECTED)
    }

    #[test]
    fn reads_the_unambiguous_surfaces_without_the_previous_phase() {
        assert_eq!(phase_of(InPitStall, OnTrack, false, Moving), Stall);
        assert_eq!(phase_of(ON_TRACK, Stall, false, Moving), OnTrack);
    }

    #[test]
    fn tells_pit_entry_from_pit_exit_by_where_the_car_came_from() {
        assert_eq!(phase_of(AproachingPits, OnTrack, false, Moving), PitIn);
        assert_eq!(phase_of(AproachingPits, Stall, false, Moving), PitOut);
        assert_eq!(phase_of(AproachingPits, PitOut, false, Moving), PitOut);
    }

    #[test]
    fn assumes_pit_entry_without_a_trustworthy_previous_phase() {
        assert_eq!(phase_of(AproachingPits, Unknown, false, Moving), PitIn);
    }

    #[test]
    fn drops_to_unknown_when_the_car_leaves_the_world() {
        assert_eq!(phase_of(NotInWorld, OnTrack, false, Moving), Unknown);
        assert_eq!(phase_of(NotInWorld, PitOut, false, Moving), Unknown);
    }

    #[test]
    fn keeps_the_phase_across_an_off_track_reading() {
        assert_eq!(phase_of(OffTrack, OnTrack, false, Moving), OnTrack);
        assert_eq!(phase_of(OffTrack, Stall, false, Moving), Stall);
    }

    #[test]
    fn trusts_the_pit_road_flag_over_an_on_track_surface() {
        assert_eq!(phase_of(ON_TRACK, Unknown, true, Moving), PitIn);
        assert_eq!(phase_of(ON_TRACK, Stall, true, Moving), PitOut);
    }

    #[test]
    fn reads_a_clean_on_track_surface_as_on_track_once_the_flag_clears() {
        assert_eq!(phase_of(ON_TRACK, PitOut, false, Moving), OnTrack);
    }

    #[test]
    fn never_resurrects_a_pit_out_phase_after_the_car_is_removed() {
        let mut phase = phase_of(InPitStall, Unknown, false, Moving);
        phase = phase_of(AproachingPits, phase, false, Moving);
        assert_eq!(phase, PitOut);

        phase = phase_of(NotInWorld, phase, false, Moving);
        assert_eq!(phase, Unknown);
    }

    #[test]
    fn reads_a_car_standing_still_in_the_pit_lane_as_parked() {
        assert_eq!(phase_of(AproachingPits, PitOut, false, Stationary), Parked);
        assert_eq!(phase_of(AproachingPits, Unknown, false, Stationary), Parked);
        assert_eq!(phase_of(ON_TRACK, Stall, true, Stationary), Parked);
    }

    #[test]
    fn does_not_hold_a_pit_exit_open_while_the_car_is_parked_after_its_stall() {
        let mut phase = phase_of(InPitStall, Unknown, false, Moving);
        phase = phase_of(AproachingPits, phase, false, Moving);
        assert_eq!(phase, PitOut);

        phase = phase_of(AproachingPits, phase, false, Stationary);
        assert_eq!(phase, Parked);

        phase = phase_of(AproachingPits, phase, false, Stationary);
        assert_eq!(phase, Parked);
    }

    #[test]
    fn reads_a_parked_car_that_moves_off_as_leaving_the_pits() {
        assert_eq!(phase_of(AproachingPits, Parked, false, Moving), PitOut);
        assert_eq!(phase_of(ON_TRACK, Parked, true, Moving), PitOut);
    }

    #[test]
    fn never_parks_a_car_standing_on_the_track_where_it_is_expected() {
        assert_eq!(phase_of(ON_TRACK, OnTrack, false, Stationary), OnTrack);
        assert_eq!(phase_of(ON_TRACK, Unknown, false, Stationary), OnTrack);
        assert_eq!(phase_of(InPitStall, PitIn, false, Stationary), Stall);
    }

    #[test]
    fn parks_a_still_on_track_car_that_came_straight_from_the_pit_lane() {
        for previous in [PitIn, PitOut, Parked, Stall] {
            assert_eq!(
                next_phase(ON_TRACK, previous, false, Stationary, NOT_EXPECTED),
                Parked
            );
        }
    }

    #[test]
    fn a_car_from_the_pit_lane_waiting_where_it_is_expected_stays_on_track() {
        for previous in [PitIn, PitOut, Parked, Stall] {
            assert_eq!(phase_of(ON_TRACK, previous, false, Settling), OnTrack);
            assert_eq!(phase_of(ON_TRACK, previous, false, Stationary), OnTrack);
        }
    }

    #[test]
    fn keeps_the_pit_phase_while_a_car_from_the_pit_lane_settles_on_track() {
        for previous in [PitIn, PitOut, Parked, Stall] {
            assert_eq!(
                next_phase(ON_TRACK, previous, false, Settling, NOT_EXPECTED),
                previous
            );
        }
    }

    #[test]
    fn parks_a_still_on_track_car_the_session_does_not_expect_on_circuit() {
        assert_eq!(
            next_phase(ON_TRACK, Unknown, false, Stationary, NOT_EXPECTED),
            Parked
        );
        assert_eq!(
            next_phase(ON_TRACK, OnTrack, false, Stationary, NOT_EXPECTED),
            Parked
        );
    }

    #[test]
    fn waits_out_the_hold_before_parking_on_context_alone() {
        assert_eq!(
            next_phase(ON_TRACK, Unknown, false, Settling, NOT_EXPECTED),
            OnTrack
        );
    }

    #[test]
    fn reads_a_parked_car_that_drives_off_on_track_as_on_track() {
        assert_eq!(
            next_phase(ON_TRACK, Parked, false, Moving, NOT_EXPECTED),
            OnTrack
        );
        assert_eq!(phase_of(ON_TRACK, Parked, false, Moving), OnTrack);
    }

    #[test]
    fn expects_the_pace_car_on_track_before_the_start() {
        for state in [
            SessionState::Invalid,
            SessionState::GetInCar,
            SessionState::Warmup,
            SessionState::ParadeLaps,
        ] {
            assert!(expected_on_track(NOT_LINED_UP, Some(state), Some(0)));
        }

        assert!(expected_on_track(NOT_LINED_UP, None, None));
    }

    #[test]
    fn expects_the_pace_car_on_track_with_the_field_lined_up_or_under_caution() {
        let racing = Some(SessionState::Racing);

        assert!(expected_on_track(LINED_UP, racing, Some(0)));
        assert!(expected_on_track(NOT_LINED_UP, racing, Some(CAUTION)));
        assert!(expected_on_track(
            NOT_LINED_UP,
            racing,
            Some(CAUTION_WAVING)
        ));
    }

    #[test]
    fn does_not_expect_the_pace_car_on_track_under_green_or_after_it() {
        for state in [
            SessionState::Racing,
            SessionState::Checkered,
            SessionState::CoolDown,
        ] {
            assert!(!expected_on_track(NOT_LINED_UP, Some(state), Some(0)));
        }
    }

    #[test]
    fn a_pace_mode_without_pace_lines_is_not_a_lined_up_field() {
        let after_the_green = PacingFrame {
            formation: PaceFormation::DoubleFile,
            car_idx_pace_line: vec![-1, -1, -1],
        };
        let on_the_grid = PacingFrame {
            formation: PaceFormation::DoubleFile,
            car_idx_pace_line: vec![-1, 0, 1],
        };
        let no_pace_mode = PacingFrame {
            formation: PaceFormation::NotPacing,
            car_idx_pace_line: vec![0, 1],
        };

        assert!(!field_lined_up(&after_the_green));
        assert!(field_lined_up(&on_the_grid));
        assert!(!field_lined_up(&no_pace_mode));
    }

    const PACE_CAR: i32 = 2;

    fn step_at(
        processor: &mut PaceCarProcessor,
        surface: TrackSurface,
        lap_dist: f32,
        now_s: f64,
    ) -> PaceCarPitPhase {
        step_in_context(processor, surface, lap_dist, EXPECTED, now_s)
    }

    fn step_in_context(
        processor: &mut PaceCarProcessor,
        surface: TrackSurface,
        lap_dist: f32,
        expected_on_track: bool,
        now_s: f64,
    ) -> PaceCarPitPhase {
        processor
            .step(
                &[PACE_CAR],
                |_| surface,
                |_| false,
                |_| lap_dist,
                expected_on_track,
                now_s,
            )
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
    fn a_car_stopping_in_an_on_track_pocket_after_the_lane_parks() {
        let mut processor = PaceCarProcessor::default();

        let mut green = |surface, lap_dist, now_s| {
            step_in_context(&mut processor, surface, lap_dist, NOT_EXPECTED, now_s)
        };

        assert_eq!(green(AproachingPits, 0.10, 0.0), PitIn);
        assert_eq!(green(ON_TRACK, 0.10, 0.5), PitIn);
        assert_eq!(green(ON_TRACK, 0.10, 2.0), Parked);
        assert_eq!(green(ON_TRACK, 0.11, 2.5), OnTrack);
    }

    #[test]
    fn a_car_stopping_past_the_pit_exit_under_caution_stays_on_track() {
        let mut processor = PaceCarProcessor::default();

        assert_eq!(step_at(&mut processor, AproachingPits, 0.10, 0.0), PitIn);
        assert_eq!(step_at(&mut processor, ON_TRACK, 0.10, 0.5), OnTrack);
        assert_eq!(step_at(&mut processor, ON_TRACK, 0.10, 3.0), OnTrack);
    }

    #[test]
    fn a_car_left_on_track_parks_once_the_caution_is_over() {
        let mut processor = PaceCarProcessor::default();

        step_at(&mut processor, ON_TRACK, 0.10, 0.0);
        assert_eq!(step_at(&mut processor, ON_TRACK, 0.10, 3.0), OnTrack);

        assert_eq!(
            step_in_context(&mut processor, ON_TRACK, 0.10, NOT_EXPECTED, 3.1),
            Parked
        );
    }

    #[test]
    fn a_car_standing_on_track_under_green_parks_with_no_history() {
        let mut processor = PaceCarProcessor::default();

        assert_eq!(
            step_in_context(&mut processor, ON_TRACK, 0.3, NOT_EXPECTED, 0.0),
            OnTrack
        );
        assert_eq!(
            step_in_context(&mut processor, ON_TRACK, 0.3, NOT_EXPECTED, 2.0),
            Parked
        );
    }

    #[test]
    fn a_car_waiting_ahead_of_the_grid_stays_on_track() {
        let mut processor = PaceCarProcessor::default();

        step_at(&mut processor, NotInWorld, -1.0, 0.0);
        step_at(&mut processor, ON_TRACK, 0.98, 1.0);

        assert_eq!(step_at(&mut processor, ON_TRACK, 0.98, 10.0), OnTrack);
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

        let frame = processor.step(&[3, 7], |_| ON_TRACK, |_| false, |_| 0.5, EXPECTED, 0.0);

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
            .step(&[], |_| ON_TRACK, |_| false, |_| 0.5, EXPECTED, 0.0)
            .cars
            .is_empty());
    }
}
