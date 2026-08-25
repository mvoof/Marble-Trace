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

    if new_lap_elapsed_s >= SETTLE_GRACE_S {
        return true;
    }

    baseline.is_none_or(|before| (reading - before).abs() > LAP_TIME_EPSILON)
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
}
