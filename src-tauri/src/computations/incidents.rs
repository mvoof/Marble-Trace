//! Where the trouble is.
//!
//! iRacing tells us a yellow or a debris flag is out, but never where: both
//! live in the session-wide `SessionFlags` bit field, and `CarIdxSessionFlags`
//! carries only the flags addressed to one driver — black, disqualify, furled,
//! servicible, repair. There is no per-car yellow to cluster, so a flagged
//! stretch of the lap cannot be read off the flag bits at all.
//!
//! What the frame does carry is every car's position and track surface. A car
//! stopped on the racing line, or sitting off it, is the incident — and it has
//! a real coordinate. This processor finds those cars and publishes where they
//! are; the widgets draw a warning zone around each one.

use std::collections::{HashMap, VecDeque};

use crate::capabilities::Capabilities;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use crate::model::cars::CarIdxFrame;
use crate::model::enums::TrackSurface;
use serde::{Deserialize, Serialize};

/// Below this a car on track is stopped, not slow. A spun car rolling backwards
/// and a car crawling out of a gravel trap are both well under it, while the
/// slowest genuine racing speed — a hairpin in a heavy car — is not.
const STOPPED_KMH: f32 = 15.0;

/// Speed is measured over this many ticks rather than one. The sim repeats a
/// remote car's coordinate for a few frames and then jumps it, so a single
/// 100 ms step reads a car braking for a hairpin as standing still.
const SPEED_WINDOW_TICKS: usize = 10;

/// Fewer samples than this give no speed at all — the window is still filling.
const MIN_SPEED_SAMPLES: usize = 5;

/// A car has to hold the condition this long before it counts. Together with
/// the speed window this is two seconds of a car that is genuinely not moving.
const CONFIRM_SECONDS: f32 = 1.0;

/// Off the road and slower than this is a car in trouble: spun into the gravel
/// or crawling back. Faster is a car running wide out of a corner or cutting a
/// kerb, which the driver behind does not need warned about.
const OFF_TRACK_SLOW_KMH: f32 = 80.0;

/// A slow car off the road confirms fast: the driver behind wants to know
/// before it has settled.
const OFF_TRACK_CONFIRM_SECONDS: f32 = 0.5;

/// Off the road at speed for this long is no longer running wide — the car is
/// sliding through a run-off and will come back across the racing line.
const OFF_TRACK_FAST_CONFIRM_SECONDS: f32 = 2.5;

/// How long a cleared incident stays on the map. A car that spun, recovered and
/// drove off leaves marbles and a slow rejoining car behind it; the marker
/// outliving the event by a few seconds is the point, not a bug.
const LINGER_SECONDS: f32 = 12.0;

/// A lap fraction this small is a position that has not moved. Guards the speed
/// estimate against the sim repeating a remote car's coordinate.
const MIN_TICK_SECONDS: f32 = 0.001;

/// Why a car is marked. The widgets colour every kind the same for now; the
/// distinction is here because the answer to "is it still there" differs.
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum IncidentKind {
    /// The car is off the racing surface.
    #[default]
    OffTrack,
    /// The car is on track and not moving.
    Stopped,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IncidentPoint {
    pub car_idx: i32,
    /// Where the car was when it was last seen in trouble.
    pub lap_dist_pct: f32,
    pub kind: IncidentKind,
    /// True while the car is still in trouble; false once it recovered and the
    /// marker is only lingering.
    pub is_active: bool,
}

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct IncidentsFrame {
    pub incidents: Vec<IncidentPoint>,
}

#[derive(Debug, Default, Clone)]
pub struct CarState {
    /// The last `SPEED_WINDOW_TICKS` positions, oldest first.
    recent_pcts: VecDeque<f32>,
    /// Seconds the car has held a trouble condition without a break.
    trouble_seconds: f32,
    /// Which condition those seconds belong to.
    trouble_kind: Option<IncidentKind>,
    /// Seconds left before a cleared marker is dropped. Zero when not marked.
    linger_seconds: f32,
    marked_at_pct: f32,
    marked_kind: IncidentKind,
}

#[derive(Default)]
pub struct IncidentsProcessor {
    cars: HashMap<i32, CarState>,
}

/// Shortest signed distance between two lap fractions, following the wrap.
fn lap_delta_pct(from: f32, to: f32) -> f32 {
    let mut delta = to - from;

    if delta > 0.5 {
        delta -= 1.0;
    }

    if delta < -0.5 {
        delta += 1.0;
    }

    delta
}

/// Average speed over the position window, following the lap wrap.
fn window_speed_kmh(recent_pcts: &VecDeque<f32>, track_length_m: f32, tick: f32) -> Option<f32> {
    // Without a track length the movement cannot be turned into a speed at
    // all, and a zero would read as "stopped" for every car on the grid.
    if recent_pcts.len() < MIN_SPEED_SAMPLES || track_length_m <= 0.0 {
        return None;
    }

    let travelled_pct: f32 = recent_pcts
        .iter()
        .zip(recent_pcts.iter().skip(1))
        .map(|(previous, current)| lap_delta_pct(*previous, *current))
        .sum();
    let elapsed = (recent_pcts.len() - 1) as f32 * tick;

    Some(travelled_pct.abs() * track_length_m / elapsed * 3.6)
}

/// The trouble a car is in right now, if any.
fn classify(surface: TrackSurface, speed_kmh: Option<f32>) -> Option<IncidentKind> {
    match surface {
        TrackSurface::OffTrack => Some(IncidentKind::OffTrack),
        TrackSurface::OnTrack => match speed_kmh {
            Some(speed) if speed < STOPPED_KMH => Some(IncidentKind::Stopped),
            _ => None,
        },
        // A car in the pits, in its stall or out of the world is not a hazard
        // on the racing surface — whatever else it may be.
        _ => None,
    }
}

pub fn compute(
    car_idx: &CarIdxFrame,
    track_length_m: f32,
    tick_seconds: f32,
    cars: &mut HashMap<i32, CarState>,
) -> IncidentsFrame {
    let tick = tick_seconds.max(MIN_TICK_SECONDS);
    let mut incidents = Vec::new();
    let mut seen: Vec<i32> = Vec::new();

    for (idx, &lap_dist_pct) in car_idx.car_idx_lap_dist_pct.iter().enumerate() {
        let car_index = idx as i32;
        let surface = car_idx
            .car_idx_track_surface
            .get(idx)
            .copied()
            .unwrap_or(TrackSurface::NotInWorld);

        let state = cars.entry(car_index).or_default();

        seen.push(car_index);

        if surface == TrackSurface::NotInWorld || lap_dist_pct < 0.0 {
            state.recent_pcts.clear();
            state.trouble_seconds = 0.0;
            state.trouble_kind = None;
            // A car that left the world mid-incident keeps its marker: it was
            // towed away from a place that is still worth knowing about.
            state.linger_seconds = (state.linger_seconds - tick).max(0.0);

            if state.linger_seconds > 0.0 {
                incidents.push(IncidentPoint {
                    car_idx: car_index,
                    lap_dist_pct: state.marked_at_pct,
                    kind: state.marked_kind,
                    is_active: false,
                });
            }

            continue;
        }

        if state.recent_pcts.len() == SPEED_WINDOW_TICKS {
            state.recent_pcts.pop_front();
        }

        state.recent_pcts.push_back(lap_dist_pct);

        let speed_kmh = window_speed_kmh(&state.recent_pcts, track_length_m, tick);
        let trouble = classify(surface, speed_kmh);

        // Until the window has filled there is no speed, and an off-track car
        // is held to the long confirm — it may well be running wide at speed.
        let confirm_seconds = match trouble {
            Some(IncidentKind::OffTrack) => match speed_kmh {
                Some(speed) if speed < OFF_TRACK_SLOW_KMH => OFF_TRACK_CONFIRM_SECONDS,
                _ => OFF_TRACK_FAST_CONFIRM_SECONDS,
            },
            _ => CONFIRM_SECONDS,
        };

        if let Some(kind) = trouble {
            // The two kinds confirm at different speeds, so the seconds spent
            // in one are not credit towards the other.
            if state.trouble_kind != Some(kind) {
                state.trouble_seconds = 0.0;
                state.trouble_kind = Some(kind);
            }

            state.trouble_seconds += tick;

            if state.trouble_seconds >= confirm_seconds {
                state.marked_at_pct = lap_dist_pct;
                state.marked_kind = kind;
                state.linger_seconds = LINGER_SECONDS;

                incidents.push(IncidentPoint {
                    car_idx: car_index,
                    lap_dist_pct,
                    kind,
                    is_active: true,
                });

                continue;
            }
        } else {
            state.trouble_seconds = 0.0;
            state.trouble_kind = None;
        }

        state.linger_seconds = (state.linger_seconds - tick).max(0.0);

        if state.linger_seconds > 0.0 {
            incidents.push(IncidentPoint {
                car_idx: car_index,
                lap_dist_pct: state.marked_at_pct,
                kind: state.marked_kind,
                is_active: false,
            });
        }
    }

    cars.retain(|car_index, _| seen.contains(car_index));

    IncidentsFrame { incidents }
}

impl Processor for IncidentsProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::Incidents
    }

    fn required(&self) -> Capabilities {
        Capabilities::STANDINGS
    }

    fn rate(&self) -> TickRate {
        TickRate::Hz10
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        let frame = compute(ctx.car_idx, ctx.track_length_m, 1.0 / 10.0, &mut self.cars);

        Some(ComputedOutput::Incidents(frame))
    }

    fn reset(&mut self) {
        self.cars.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const TRACK_M: f32 = 5000.0;
    const TICK: f32 = 0.1;

    fn frame(pcts: &[f32], surfaces: &[TrackSurface]) -> CarIdxFrame {
        CarIdxFrame {
            car_idx_lap_dist_pct: pcts.to_vec(),
            car_idx_track_surface: surfaces.to_vec(),
            ..Default::default()
        }
    }

    #[test]
    fn a_car_racing_normally_is_not_an_incident() {
        let mut cars = HashMap::new();
        let mut pct = 0.1;

        for _ in 0..40 {
            // 0.002 of a 5 km lap per 100 ms is 360 km/h — plainly racing.
            pct += 0.002;

            let out = compute(
                &frame(&[pct], &[TrackSurface::OnTrack]),
                TRACK_M,
                TICK,
                &mut cars,
            );

            assert!(out.incidents.is_empty());
        }
    }

    #[test]
    fn a_stopped_car_is_marked_after_the_confirm_window() {
        let mut cars = HashMap::new();
        let mut marked = false;

        for tick in 0..30 {
            let out = compute(
                &frame(&[0.42], &[TrackSurface::OnTrack]),
                TRACK_M,
                TICK,
                &mut cars,
            );

            if tick < 9 {
                assert!(out.incidents.is_empty(), "marked too early at tick {tick}");
            }

            if !out.incidents.is_empty() {
                marked = true;

                assert_eq!(out.incidents[0].kind, IncidentKind::Stopped);
                assert!(out.incidents[0].is_active);
                assert!((out.incidents[0].lap_dist_pct - 0.42).abs() < 1e-6);
            }
        }

        assert!(marked);
    }

    #[test]
    fn a_brief_off_track_excursion_does_not_mark() {
        let mut cars = HashMap::new();
        let mut pct = 0.3;

        // Two ticks off the road at racing speed — under the confirm window.
        for tick in 0..2 {
            pct += 0.002;

            let surface = if tick == 0 {
                TrackSurface::OffTrack
            } else {
                TrackSurface::OnTrack
            };

            let out = compute(&frame(&[pct], &[surface]), TRACK_M, TICK, &mut cars);

            assert!(out.incidents.is_empty());
        }
    }

    #[test]
    fn a_recovered_car_lingers_then_clears() {
        let mut cars = HashMap::new();

        for _ in 0..20 {
            compute(
                &frame(&[0.5], &[TrackSurface::OffTrack]),
                TRACK_M,
                TICK,
                &mut cars,
            );
        }

        let mut pct = 0.5;
        let mut saw_lingering = false;

        for _ in 0..40 {
            pct += 0.002;

            let out = compute(
                &frame(&[pct], &[TrackSurface::OnTrack]),
                TRACK_M,
                TICK,
                &mut cars,
            );

            if let Some(point) = out.incidents.first() {
                assert!(!point.is_active);
                assert!((point.lap_dist_pct - 0.5).abs() < 1e-6);

                saw_lingering = true;
            }
        }

        assert!(saw_lingering, "the marker should outlive the excursion");

        for _ in 0..((LINGER_SECONDS / TICK) as i32 + 2) {
            pct += 0.002;

            compute(
                &frame(&[pct], &[TrackSurface::OnTrack]),
                TRACK_M,
                TICK,
                &mut cars,
            );
        }

        let out = compute(
            &frame(&[pct], &[TrackSurface::OnTrack]),
            TRACK_M,
            TICK,
            &mut cars,
        );

        assert!(out.incidents.is_empty(), "the marker should have expired");
    }

    #[test]
    fn a_car_in_the_pits_is_never_an_incident() {
        let mut cars = HashMap::new();

        for _ in 0..40 {
            let out = compute(
                &frame(&[0.02], &[TrackSurface::InPitStall]),
                TRACK_M,
                TICK,
                &mut cars,
            );

            assert!(out.incidents.is_empty());
        }
    }

    fn run(cars: &mut HashMap<i32, CarState>, pct: f32, surface: TrackSurface) -> IncidentsFrame {
        compute(&frame(&[pct], &[surface]), TRACK_M, TICK, cars)
    }

    #[test]
    fn braking_into_a_hairpin_is_not_an_incident() {
        let mut cars = HashMap::new();
        let mut pct = 0.2;
        // 360 km/h down to 40 km/h and back up, with the sim repeating the
        // coordinate on every other frame the way it does for remote cars.
        let speeds_pct: Vec<f32> = (0..60)
            .map(|tick| {
                let phase = (tick as f32 - 30.0).abs() / 30.0;

                0.000_222 + (0.002 - 0.000_222) * phase
            })
            .collect();

        for (tick, step) in speeds_pct.iter().enumerate() {
            if tick % 2 == 1 {
                pct += step * 2.0;
            }

            assert!(run(&mut cars, pct, TrackSurface::OnTrack)
                .incidents
                .is_empty());
        }
    }

    #[test]
    fn running_wide_at_speed_is_not_an_incident() {
        let mut cars = HashMap::new();
        let mut pct = 0.6;

        for tick in 0..40 {
            pct += 0.001;

            let surface = if (10..25).contains(&tick) {
                TrackSurface::OffTrack
            } else {
                TrackSurface::OnTrack
            };

            assert!(run(&mut cars, pct, surface).incidents.is_empty());
        }
    }

    #[test]
    fn a_long_slide_through_a_run_off_is_marked() {
        let mut cars = HashMap::new();
        let mut pct = 0.6;
        let mut marked = false;

        for _ in 0..40 {
            pct += 0.001;

            marked |= !run(&mut cars, pct, TrackSurface::OffTrack)
                .incidents
                .is_empty();
        }

        assert!(marked);
    }

    #[test]
    fn lap_delta_follows_the_wrap() {
        assert!((lap_delta_pct(0.99, 0.01) - 0.02).abs() < 1e-6);
        assert!((lap_delta_pct(0.01, 0.99) + 0.02).abs() < 1e-6);
    }
}
