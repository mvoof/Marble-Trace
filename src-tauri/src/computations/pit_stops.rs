//! The player's pit stops this session: how many, and how long the crew works.
//!
//! The sim reports no service duration at all, so the only honest answer to
//! "how long will this stop take" is how long the last one took. That history
//! used to live in each window's pit widget, where a reloaded overlay forgot it
//! and an overlay and a remote screen could show different numbers; it is kept
//! here once.

use crate::capabilities::Capabilities;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use serde::{Deserialize, Serialize};

#[cfg_attr(feature = "dev", derive(specta::Type))]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PitStopsFrame {
    pub player_stops: u32,
    /// Seconds the crew has been working on the car this stop; `None` while it
    /// is not. The window runs its own clock between frames from this anchor —
    /// 4 Hz is too coarse to read as a running timer.
    pub service_elapsed_s: Option<f32>,
    /// How long the crew worked on the previous stop this session.
    pub last_service_s: Option<f32>,
}

/// One pit-stop step's input, so the logic is testable without a frame.
#[derive(Debug, Clone, Copy)]
pub struct PitStopsInput {
    pub session_num: Option<i32>,
    pub on_pit_road: bool,
    /// Whether the crew is working on the car — what the stop clock runs on,
    /// not standing in the box: the car sits in the stall before and after.
    pub service_active: bool,
    /// The session clock, which stops with the sim.
    pub now_s: Option<f64>,
}

pub struct PitStopsProcessor {
    stops: u32,
    was_on_pit_road: bool,
    tracked_session_num: Option<i32>,
    service_started_at_s: Option<f64>,
    last_service_s: Option<f32>,
}

impl Default for PitStopsProcessor {
    fn default() -> Self {
        Self {
            stops: 0,
            was_on_pit_road: false,
            // A value no session reports, so the first frame always starts one.
            tracked_session_num: Some(i32::MIN),
            service_started_at_s: None,
            last_service_s: None,
        }
    }
}

impl PitStopsProcessor {
    pub fn step(&mut self, input: PitStopsInput) -> PitStopsFrame {
        if input.session_num != self.tracked_session_num {
            *self = Self {
                tracked_session_num: input.session_num,
                ..Self::default()
            };
        }

        if input.on_pit_road && !self.was_on_pit_road {
            self.stops += 1;
        }

        self.was_on_pit_road = input.on_pit_road;

        let service_elapsed_s = self.step_service_clock(input.service_active, input.now_s);

        PitStopsFrame {
            player_stops: self.stops,
            service_elapsed_s,
            last_service_s: self.last_service_s,
        }
    }

    fn step_service_clock(&mut self, service_active: bool, now_s: Option<f64>) -> Option<f32> {
        let now_s = now_s?;

        match (service_active, self.service_started_at_s) {
            (true, None) => {
                self.service_started_at_s = Some(now_s);

                Some(0.0)
            }
            (true, Some(started_at_s)) => Some((now_s - started_at_s).max(0.0) as f32),
            (false, Some(started_at_s)) => {
                let duration_s = (now_s - started_at_s) as f32;

                // A service that never got going says nothing about the next one.
                if duration_s > 0.0 {
                    self.last_service_s = Some(duration_s);
                }

                self.service_started_at_s = None;

                None
            }
            (false, None) => None,
        }
    }
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
        let frame = self.step(PitStopsInput {
            session_num: ctx.session_num,
            on_pit_road: ctx.car_status.on_pit_road?,
            service_active: ctx.pit_service.service_active,
            now_s: ctx.session_time,
        });

        Some(ComputedOutput::PitStops(frame))
    }

    fn reset(&mut self) {
        *self = Self::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SESSION: Option<i32> = Some(2);

    fn input(on_pit_road: bool, service_active: bool, now_s: f64) -> PitStopsInput {
        PitStopsInput {
            session_num: SESSION,
            on_pit_road,
            service_active,
            now_s: Some(now_s),
        }
    }

    #[test]
    fn counts_a_stop_on_entering_pit_road() {
        let mut processor = PitStopsProcessor::default();

        assert_eq!(processor.step(input(false, false, 0.0)).player_stops, 0);
        assert_eq!(processor.step(input(true, false, 1.0)).player_stops, 1);
        assert_eq!(processor.step(input(true, false, 2.0)).player_stops, 1);
        processor.step(input(false, false, 3.0));
        assert_eq!(processor.step(input(true, false, 4.0)).player_stops, 2);
    }

    #[test]
    fn a_window_opened_on_pit_road_counts_the_stop_it_sees() {
        let mut processor = PitStopsProcessor::default();

        assert_eq!(processor.step(input(true, false, 0.0)).player_stops, 1);
    }

    #[test]
    fn times_the_service_and_remembers_it_for_the_next_stop() {
        let mut processor = PitStopsProcessor::default();

        processor.step(input(true, false, 10.0));
        assert_eq!(
            processor.step(input(true, true, 12.0)).service_elapsed_s,
            Some(0.0)
        );
        assert_eq!(
            processor.step(input(true, true, 20.5)).service_elapsed_s,
            Some(8.5)
        );

        let after = processor.step(input(true, false, 24.0));

        assert_eq!(after.service_elapsed_s, None);
        assert_eq!(after.last_service_s, Some(12.0));
    }

    #[test]
    fn standing_in_the_stall_without_service_runs_no_clock() {
        let mut processor = PitStopsProcessor::default();

        let frame = processor.step(input(true, false, 5.0));

        assert_eq!(frame.service_elapsed_s, None);
        assert_eq!(frame.last_service_s, None);
    }

    #[test]
    fn a_service_that_never_got_going_keeps_the_previous_duration() {
        let mut processor = PitStopsProcessor::default();

        processor.step(input(true, true, 0.0));
        processor.step(input(true, false, 30.0));
        processor.step(input(true, true, 100.0));

        assert_eq!(
            processor.step(input(true, false, 100.0)).last_service_s,
            Some(30.0)
        );
    }

    #[test]
    fn a_towed_car_serviced_in_its_stall_is_timed_like_any_stop() {
        let mut processor = PitStopsProcessor::default();

        // A tow drops the car straight into its stall: pit road and service
        // arrive together, with no approach.
        let first = processor.step(input(true, true, 50.0));

        assert_eq!(first.player_stops, 1);
        assert_eq!(first.service_elapsed_s, Some(0.0));
        assert_eq!(
            processor.step(input(true, false, 65.0)).last_service_s,
            Some(15.0)
        );
    }

    #[test]
    fn a_new_session_forgets_the_stops_and_the_last_service() {
        let mut processor = PitStopsProcessor::default();

        processor.step(input(true, true, 0.0));
        processor.step(input(true, false, 20.0));

        let next = processor.step(PitStopsInput {
            session_num: Some(3),
            ..input(false, false, 0.0)
        });

        assert_eq!(next.player_stops, 0);
        assert_eq!(next.last_service_s, None);
    }

    #[test]
    fn no_session_clock_runs_no_service_clock() {
        let mut processor = PitStopsProcessor::default();

        let frame = processor.step(PitStopsInput {
            now_s: None,
            ..input(true, true, 0.0)
        });

        assert_eq!(frame.player_stops, 1);
        assert_eq!(frame.service_elapsed_s, None);
    }

    #[test]
    fn reset_starts_from_nothing() {
        let mut processor = PitStopsProcessor::default();

        processor.step(input(true, true, 0.0));
        processor.step(input(true, false, 10.0));
        processor.reset();

        let frame = processor.step(input(false, false, 11.0));

        assert_eq!(frame.player_stops, 0);
        assert_eq!(frame.last_service_s, None);
    }
}
