//! Tire pressures dialed by hand — the − / + beside a tread and the pressure
//! keys — and sent as one order once the steps stop.
//!
//! A step is not sent on its own: a burst of presses would go out as a burst
//! of orders, and the sim does not report a pressure set over the broadcast
//! channel back in `PitSvLFP`, so each would be counted from the same stale
//! figure. The dial adds the steps up here, from the last pressure it dialed
//! or sent, and puts the total on the wire when the presses settle.

use std::time::{Duration, Instant};

use crate::strategy::pit_actions::{corner_kind, ordered_pressure};
use crate::strategy::pit_auto::PitOrder;
use mt_model::pit::pit_action::{TireCorner, TireSet};
use mt_model::pit::pit_auto::{DialedPressure, DialedPressures};
use mt_model::pit::pit_command::PitCommandRequest;
use mt_model::sim::player::PitServiceFrame;

/// How long the presses must stop before the dialed pressures go out.
pub const DIAL_SETTLE: Duration = Duration::from_millis(800);

/// The lowest pressure a step reaches: zero is the SDK's "keep what is
/// ordered", so a step down never sends it.
const MIN_PRESSURE_KPA: i32 = 1;

/// How far the sim's report may move before the dial takes it as the sim's
/// own change — the garage, the black box — rather than its stale figure.
const SIM_MOVED_KPA: f32 = 0.05;

/// A pressure sent, with what the sim reported for the corner at the time: it
/// stands until the sim reports something else.
#[derive(Debug, Clone, Copy, PartialEq)]
struct SentPressure {
    kpa: i32,
    sim_kpa: Option<f32>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq)]
struct CornerDial {
    pending_kpa: Option<i32>,
    sent: Option<SentPressure>,
}

#[derive(Debug, Clone, Default)]
pub struct PressureDial {
    corners: [CornerDial; 4],
    last_step_at: Option<Instant>,
}

const fn slot(corner: TireCorner) -> usize {
    match corner {
        TireCorner::Lf => 0,
        TireCorner::Rf => 1,
        TireCorner::Lr => 2,
        TireCorner::Rr => 3,
    }
}

impl PressureDial {
    /// Moves every corner in the set one step from the pressure it holds now.
    /// Returns whether any corner had a pressure to step from.
    pub fn step(
        &mut self,
        service: &PitServiceFrame,
        corners: TireSet,
        step_kpa: f32,
        now: Instant,
    ) -> bool {
        let mut stepped = false;

        for corner in TireCorner::ALL {
            if !corners.contains(corner) {
                continue;
            }

            let Some(held) = self.held_kpa(service, corner) else {
                continue;
            };

            let target = ((held as f32 + step_kpa).round() as i32).max(MIN_PRESSURE_KPA);

            self.corners[slot(corner)].pending_kpa = Some(target);
            stepped = true;
        }

        if stepped {
            self.last_step_at = Some(now);
        }

        stepped
    }

    /// The order for the dialed pressures once the presses have settled, and
    /// `None` until then. What it returns is taken as sent.
    pub fn take_due(&mut self, service: &PitServiceFrame, now: Instant) -> Option<PitOrder> {
        let last_step_at = self.last_step_at?;

        if now.duration_since(last_step_at) < DIAL_SETTLE {
            return None;
        }

        self.last_step_at = None;

        let mut order = PitOrder::new();

        for corner in TireCorner::ALL {
            let dial = &mut self.corners[slot(corner)];

            let Some(kpa) = dial.pending_kpa.take() else {
                continue;
            };

            dial.sent = Some(SentPressure {
                kpa,
                sim_kpa: ordered_pressure(service, corner),
            });
            order.push(PitCommandRequest {
                kind: corner_kind(corner),
                value: kpa,
            });
        }

        (!order.is_empty()).then_some(order)
    }

    /// What the widget shows over the sim's own pressures.
    pub fn frame(&self, service: &PitServiceFrame) -> DialedPressures {
        let shown = |corner: TireCorner| {
            let dial = self.corners[slot(corner)];

            match dial.pending_kpa {
                Some(kpa) => Some(DialedPressure { kpa, pending: true }),
                None => self
                    .standing_sent(service, corner)
                    .map(|kpa| DialedPressure {
                        kpa,
                        pending: false,
                    }),
            }
        };

        DialedPressures {
            lf: shown(TireCorner::Lf),
            rf: shown(TireCorner::Rf),
            lr: shown(TireCorner::Lr),
            rr: shown(TireCorner::Rr),
        }
    }

    pub fn reset(&mut self) {
        *self = Self::default();
    }

    /// The pressure a step counts from: the one being dialed, else the one
    /// last sent while the sim still reports what it did then, else the sim's.
    fn held_kpa(&self, service: &PitServiceFrame, corner: TireCorner) -> Option<i32> {
        self.corners[slot(corner)]
            .pending_kpa
            .or_else(|| self.standing_sent(service, corner))
            .or_else(|| ordered_pressure(service, corner).map(|kpa| kpa.round() as i32))
    }

    fn standing_sent(&self, service: &PitServiceFrame, corner: TireCorner) -> Option<i32> {
        let sent = self.corners[slot(corner)].sent?;
        let sim_now = ordered_pressure(service, corner);
        let sim_unmoved = match (sent.sim_kpa, sim_now) {
            (Some(then), Some(now)) => (then - now).abs() < SIM_MOVED_KPA,
            (None, None) => true,
            _ => false,
        };

        sim_unmoved.then_some(sent.kpa)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mt_model::pit::pit_command::PitCommandKind;

    const LF: TireSet = TireSet {
        lf: true,
        ..TireSet::NONE
    };

    fn service(lf_kpa: f32) -> PitServiceFrame {
        PitServiceFrame {
            lf_pressure: Some(lf_kpa),
            rf_pressure: Some(170.0),
            ..PitServiceFrame::default()
        }
    }

    fn sent(order: Option<PitOrder>) -> Vec<(PitCommandKind, i32)> {
        order
            .unwrap_or_default()
            .into_iter()
            .map(|request| (request.kind, request.value))
            .collect()
    }

    #[test]
    fn adds_the_steps_up_and_sends_once_they_settle() {
        let sim = service(152.4);
        let start = Instant::now();
        let mut dial = PressureDial::default();

        dial.step(&sim, LF, 1.0, start);
        dial.step(&sim, LF, 1.0, start + Duration::from_millis(200));
        dial.step(&sim, LF, 1.0, start + Duration::from_millis(400));

        assert_eq!(
            dial.frame(&sim).lf,
            Some(DialedPressure {
                kpa: 155,
                pending: true
            })
        );
        assert!(dial
            .take_due(&sim, start + Duration::from_millis(900))
            .is_none());
        assert_eq!(
            sent(dial.take_due(&sim, start + Duration::from_millis(1200))),
            vec![(PitCommandKind::Lf, 155)]
        );
        assert!(dial
            .take_due(&sim, start + Duration::from_millis(5000))
            .is_none());
    }

    #[test]
    fn counts_the_next_steps_from_what_was_sent_while_the_sim_lags() {
        let sim = service(152.0);
        let start = Instant::now();
        let mut dial = PressureDial::default();

        dial.step(&sim, LF, 1.0, start);
        dial.take_due(&sim, start + DIAL_SETTLE);

        assert_eq!(
            dial.frame(&sim).lf,
            Some(DialedPressure {
                kpa: 153,
                pending: false
            })
        );

        let later = start + Duration::from_secs(3);
        dial.step(&sim, LF, 1.0, later);

        assert_eq!(
            sent(dial.take_due(&sim, later + DIAL_SETTLE)),
            vec![(PitCommandKind::Lf, 154)]
        );
    }

    #[test]
    fn follows_the_sim_once_it_reports_a_pressure_of_its_own() {
        let start = Instant::now();
        let mut dial = PressureDial::default();

        dial.step(&service(152.0), LF, 1.0, start);
        dial.take_due(&service(152.0), start + DIAL_SETTLE);

        let garage = service(160.0);

        assert_eq!(dial.frame(&garage).lf, None);

        let later = start + Duration::from_secs(3);
        dial.step(&garage, LF, -1.0, later);

        assert_eq!(
            sent(dial.take_due(&garage, later + DIAL_SETTLE)),
            vec![(PitCommandKind::Lf, 159)]
        );
    }

    #[test]
    fn steps_every_corner_of_the_set_and_never_reaches_the_keep_value() {
        let sim = service(1.0);
        let start = Instant::now();
        let mut dial = PressureDial::default();

        assert!(dial.step(&sim, TireSet::ALL, -2.0, start));
        assert_eq!(
            sent(dial.take_due(&sim, start + DIAL_SETTLE)),
            vec![(PitCommandKind::Lf, 1), (PitCommandKind::Rf, 168)]
        );
    }

    #[test]
    fn a_corner_without_a_pressure_is_not_stepped() {
        let mut dial = PressureDial::default();
        let rr = TireSet {
            rr: true,
            ..TireSet::NONE
        };

        assert!(!dial.step(&service(150.0), rr, 1.0, Instant::now()));
    }
}
