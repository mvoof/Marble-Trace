//! When `lap_last_lap_time` may be believed.
//!
//! iRacing publishes a completed lap's time with a variable lag around the
//! crossing — sometimes a frame before the lap counter moves, sometimes a few
//! frames after. Until it does, the field still reads the *previous* lap's
//! time, so a reading identical to what stood before the crossing is ambiguous:
//! it is either the sim lagging, or two laps that genuinely took the same time.
//!
//! The ambiguity only lasts as long as the sim can still be lagging, which is
//! the first moments of the new lap. Past that the reading is the completed
//! lap's own, whatever it says.
//!
//! Both `lap_log` and `reference_lap` resolve a completed lap's time and each
//! used to spell this rule out for itself. They differ in everything else —
//! what marks a lap complete, what the baseline is, what an invalid lap means —
//! but not in this, and the copy that drifted lost the coach a personal best
//! whenever the sim published late or published an identical time.

/// How far into the new lap the sim may still be lagging behind the crossing
/// with `lap_last_lap_time`. Far beyond the frame or two iRacing actually takes.
pub const SETTLE_GRACE_S: f32 = 1.0;

/// Guards against float-equality false negatives when comparing lap times.
const LAP_TIME_EPSILON: f32 = 1e-4;

/// Whether `reading` differs from what stood before the crossing, which alone
/// proves the sim has published.
fn differs_from_baseline(reading: f32, baseline: Option<f32>) -> bool {
    baseline.is_none_or(|before| (reading - before).abs() > LAP_TIME_EPSILON)
}

/// Whether `reading` is the just-completed lap's own time rather than the
/// previous lap's still standing there.
///
/// `baseline` is what `lap_last_lap_time` read before the crossing (`None` when
/// nothing was recorded to compare against, which settles immediately);
/// `new_lap_elapsed_s` is `lap_current_lap_time`, how far into the new lap the
/// car is.
pub fn is_settled(reading: f32, baseline: Option<f32>, new_lap_elapsed_s: f32) -> bool {
    // `0` is the uninitialised reading, never a lap time.
    if reading == 0.0 {
        return false;
    }

    if differs_from_baseline(reading, baseline) {
        return true;
    }

    new_lap_elapsed_s >= SETTLE_GRACE_S
}

/// The same question, asked the way the reference lap has to ask it.
///
/// The lap log writes every lap and shows it, so accepting an ambiguous reading
/// costs it one wrong row that the next lap corrects. The reference lap instead
/// *keeps* what it accepts, under a lap time it will be compared against for
/// the rest of the session — a completed lap labelled with the previous lap's
/// time is a wrong reference that outlives the mistake.
///
/// So past the grace window the reading is taken only when the sim's own
/// `lap_best_lap_time` confirms it published for this lap: a lap the sim has
/// registered as the session best is a lap it has finished timing. Without that
/// confirmation the lap simply stays parked until the next crossing replaces
/// it — no reference is better than a mislabelled one.
pub fn is_settled_for_reference(
    reading: f32,
    baseline: Option<f32>,
    new_lap_elapsed_s: f32,
    session_best: Option<f32>,
) -> bool {
    if reading == 0.0 {
        return false;
    }

    if differs_from_baseline(reading, baseline) {
        return true;
    }

    if new_lap_elapsed_s < SETTLE_GRACE_S {
        return false;
    }

    session_best.is_some_and(|best| best > 0.0 && (reading - best).abs() <= LAP_TIME_EPSILON)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_reading_differing_from_the_baseline_settles_at_once() {
        assert!(is_settled(89.0, Some(90.0), 0.0));
    }

    #[test]
    fn a_reading_equal_to_the_baseline_waits_out_the_grace_window() {
        assert!(!is_settled(90.0, Some(90.0), 0.5));
        assert!(is_settled(90.0, Some(90.0), SETTLE_GRACE_S));
    }

    #[test]
    fn an_absent_baseline_settles_at_once() {
        assert!(is_settled(90.0, None, 0.0));
    }

    #[test]
    fn the_uninitialised_reading_never_settles() {
        assert!(!is_settled(0.0, Some(90.0), 0.0));
        assert!(!is_settled(0.0, None, 10.0));
    }

    #[test]
    fn an_invalidated_lap_settles_so_the_caller_can_act_on_it() {
        assert!(is_settled(-1.0, Some(90.0), 0.0));
    }

    #[test]
    fn the_reference_takes_a_reading_that_differs_without_asking_the_best() {
        assert!(is_settled_for_reference(89.0, Some(90.0), 0.0, None));
    }

    #[test]
    fn the_reference_takes_an_ambiguous_reading_the_session_best_confirms() {
        assert!(is_settled_for_reference(
            90.0,
            Some(90.0),
            SETTLE_GRACE_S,
            Some(90.0)
        ));
    }

    #[test]
    fn the_reference_leaves_an_ambiguous_reading_nothing_confirms() {
        // The sim is timing a lap it does not consider the session best, so a
        // reading equal to the previous lap's may still be the previous lap's.
        assert!(!is_settled_for_reference(
            90.0,
            Some(90.0),
            SETTLE_GRACE_S,
            Some(88.0)
        ));
        assert!(!is_settled_for_reference(
            90.0,
            Some(90.0),
            SETTLE_GRACE_S,
            None
        ));
    }

    #[test]
    fn the_reference_waits_out_the_grace_window_like_the_lap_log() {
        assert!(!is_settled_for_reference(90.0, Some(90.0), 0.5, Some(90.0)));
    }
}
