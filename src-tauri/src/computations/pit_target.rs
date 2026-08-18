//! Where the car is along the pit lane, and how far the box or the exit still is.
//!
//! The recorded lane (`pit_in_pct` → `pit_exit_pct`) comes from a previous
//! traversal, so it says how *long* the lane is reliably but not exactly where
//! this entry began: `on_pit_road` is sampled at 10 Hz, and the recording may
//! well have come from another car's entry. A few meters of disagreement is
//! enough to send `lap_dist - pit_in` the long way round the lap, which is what
//! used to paint the whole rail full the instant the car turned into the pits.
//!
//! So the entry the car actually just made is preferred as the anchor when it
//! is known, and the recorded one is the fallback — for a session joined with
//! the car already in the lane, and for the approach before the entry line.

use crate::model::enums::PitTargetType;

pub struct PitTarget {
    /// Meters to the current target.
    pub dist_m: f32,
    pub target: PitTargetType,
    /// Position along the pit lane, 0..1.
    pub lane_progress: f32,
}

/// A lane shorter than this share of the lap is a glitched recording, not a
/// pit lane — mirrors the sanity window the recording itself applies.
const MIN_LANE_LENGTH_PCT: f32 = 0.001;

/// The pit box counts as the target from this far past it, so a car that rolls
/// a meter through its stall is still shown the box rather than the exit.
const PITBOX_PASSED_TOLERANCE_M: f32 = 10.0;

/// Half a lap plus a margin: beyond it the difference went the wrong way round
/// the start/finish line.
const WRAP_MARGIN_M: f32 = 10.0;

/// Positive fraction of a lap from `from` to `to`, going forwards.
fn forward_pct(from: f32, to: f32) -> f32 {
    (to - from + 1.0) % 1.0
}

/// `pit_in_pct` / `pit_exit_pct` are the recorded lane; `live_pit_in_pct` is the
/// lap distance where the player's own `on_pit_road` went true this stint, when
/// that is known.
pub fn resolve_pit_target(
    lap_dist_pct: f32,
    pit_in_pct: f32,
    pit_exit_pct: f32,
    live_pit_in_pct: Option<f32>,
    pitbox_pct: Option<f32>,
    track_length_m: f32,
) -> Option<PitTarget> {
    if track_length_m <= 0.0 {
        return None;
    }

    let lane_length_pct = forward_pct(pit_in_pct, pit_exit_pct);

    if lane_length_pct < MIN_LANE_LENGTH_PCT {
        return None;
    }

    let traveled_from_recorded = forward_pct(pit_in_pct, lap_dist_pct);

    // Of the anchors that put the car inside the lane, the one that puts it
    // furthest along wins: an anchor taken mid-lane (a session joined in the
    // pits) reads as barely started, and it should not override an entry the
    // car really drove past.
    let traveled_pct = [
        live_pit_in_pct.map(|live| forward_pct(live, lap_dist_pct)),
        Some(traveled_from_recorded),
    ]
    .into_iter()
    .flatten()
    .filter(|traveled| *traveled <= lane_length_pct)
    .fold(None::<f32>, |best, traveled| {
        Some(best.map_or(traveled, |current: f32| current.max(traveled)))
    });

    let progress = match traveled_pct {
        Some(traveled) => traveled / lane_length_pct,
        // Outside the lane by either anchor. Which end it is outside of decides:
        // approaching the entry reads as an empty rail, and past the exit as a
        // full one — the clamp that ignored the difference was the bug.
        None => {
            let before_entry_pct = 1.0 - traveled_from_recorded;
            let past_exit_pct = traveled_from_recorded - lane_length_pct;

            if before_entry_pct < past_exit_pct {
                0.0
            } else {
                1.0
            }
        }
    };

    let dist_to_exit_m = (1.0 - progress) * lane_length_pct * track_length_m;

    let mut dist_m = dist_to_exit_m;
    let mut target = PitTargetType::PitExit;

    if let Some(pitbox) = pitbox_pct {
        let mut dist_to_pitbox = (pitbox - lap_dist_pct) * track_length_m;
        let wrap_threshold = track_length_m * 0.5 + WRAP_MARGIN_M;

        if dist_to_pitbox.abs() > wrap_threshold {
            if dist_to_pitbox > 0.0 {
                dist_to_pitbox -= track_length_m;
            } else {
                dist_to_pitbox += track_length_m;
            }
        }

        if dist_to_pitbox > -PITBOX_PASSED_TOLERANCE_M {
            dist_m = dist_to_pitbox.max(0.0);
            target = PitTargetType::Pitbox;
        }
    }

    Some(PitTarget {
        dist_m,
        target,
        lane_progress: progress,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const TRACK_M: f32 = 4000.0;
    // A lane from 90% to 4% of the lap: it crosses start/finish, which is the
    // case every wrap bug hides in.
    const PIT_IN: f32 = 0.90;
    const PIT_EXIT: f32 = 0.04;
    const PITBOX: f32 = 0.98;

    fn resolve(lap_dist: f32, live_pit_in: Option<f32>) -> PitTarget {
        resolve_pit_target(
            lap_dist,
            PIT_IN,
            PIT_EXIT,
            live_pit_in,
            Some(PITBOX),
            TRACK_M,
        )
        .expect("lane is valid")
    }

    #[test]
    fn empty_rail_while_still_approaching_the_entry() {
        // Two meters short of the recorded entry — the old clamp read this as a
        // full lane.
        let target = resolve(PIT_IN - 0.0005, None);

        assert_eq!(target.lane_progress, 0.0);
    }

    #[test]
    fn counts_from_the_entry_the_car_actually_made() {
        // The car turned in 3% of a lap before the recorded pit_in and is now
        // level with it: a third of a 14% lane rather than nothing.
        let live_entry = PIT_IN - 0.03;
        let target = resolve(PIT_IN, Some(live_entry));

        assert!((target.lane_progress - 0.03 / 0.14).abs() < 1e-4);
    }

    #[test]
    fn keeps_the_recorded_entry_when_the_live_one_is_further_along() {
        // Joined a session already halfway down the lane: the live anchor is
        // where we happened to appear, and would under-read the progress.
        let lap_dist = 0.97;
        let with_live = resolve(lap_dist, Some(lap_dist));
        let without = resolve(lap_dist, None);

        assert_eq!(with_live.lane_progress, without.lane_progress);
    }

    #[test]
    fn full_rail_just_past_the_exit() {
        let target = resolve(PIT_EXIT + 0.002, None);

        assert_eq!(target.lane_progress, 1.0);
    }

    #[test]
    fn progresses_across_start_finish() {
        let before_sf = resolve(0.99, None).lane_progress;
        let after_sf = resolve(0.01, None).lane_progress;

        assert!(before_sf > 0.0 && before_sf < 1.0);
        assert!(after_sf > before_sf);
    }

    #[test]
    fn targets_the_box_until_it_is_passed_then_the_exit() {
        let approaching = resolve(0.95, None);

        assert!(matches!(approaching.target, PitTargetType::Pitbox));
        assert!((approaching.dist_m - 0.03 * TRACK_M).abs() < 1.0);

        // Well past the stall, still in the lane.
        let leaving = resolve(0.02, None);

        assert!(matches!(leaving.target, PitTargetType::PitExit));
        assert!(leaving.dist_m > 0.0);
    }

    #[test]
    fn rejects_a_lane_with_no_length_and_a_track_with_no_length() {
        assert!(resolve_pit_target(0.5, 0.9, 0.9, None, None, TRACK_M).is_none());
        assert!(resolve_pit_target(0.5, PIT_IN, PIT_EXIT, None, None, 0.0).is_none());
    }
}
