use std::collections::HashMap;

use crate::computations::driver_entries::DriverEntry;
use crate::model::enums::TrackSurface;

/// How fast the smoothed speed follows the raw one, in seconds. iRacing
/// interpolates the other cars' lap distance from network packets, so the raw
/// derivative jitters by a few km/h tick to tick; a third of a second hides that
/// and still shows a car braking into a corner before it has finished.
const SMOOTHING_TAU_S: f64 = 0.3;

/// Anything faster is a teleport — a reset to the pits, a tow, a replay jump —
/// not a car being driven, and it restarts the estimate instead of feeding it.
const MAX_PLAUSIBLE_SPEED_MPS: f64 = 150.0;

/// Past this long between two samples of one car the derivative says nothing
/// about how fast it is going now.
const MAX_SAMPLE_GAP_S: f64 = 1.0;

struct Sample {
    lap_dist_pct: f32,
    session_time: f64,
    speed: f64,
}

/// Every car's speed along the track, in m/s, derived from its lap distance.
///
/// The sim reports speed only for the player's own car; for everyone else the
/// lap distance is the only thing that moves. The player's entry takes the real
/// speed instead, so the two sides of a comparison come from sources as close as
/// the sim allows rather than one of them being an estimate of the other.
#[derive(Default)]
pub struct CarSpeedTracker {
    samples: HashMap<i32, Sample>,
}

impl CarSpeedTracker {
    pub fn apply(
        &mut self,
        entries: &mut [DriverEntry],
        session_time: Option<f64>,
        track_length_m: f32,
        player_speed: f32,
    ) {
        let Some(now) = session_time else {
            return;
        };

        if track_length_m <= 0.0 {
            return;
        }

        for entry in entries.iter_mut() {
            if entry.is_player {
                entry.speed = player_speed.max(0.0);

                continue;
            }

            entry.speed = self.track(entry, now, f64::from(track_length_m));
        }
    }

    pub fn reset(&mut self) {
        self.samples.clear();
    }

    fn track(&mut self, entry: &DriverEntry, now: f64, track_length_m: f64) -> f32 {
        let in_world = entry.track_surface != TrackSurface::NotInWorld && entry.lap_dist_pct >= 0.0;

        if !in_world {
            self.samples.remove(&entry.car_idx);

            return 0.0;
        }

        let fresh = Sample {
            lap_dist_pct: entry.lap_dist_pct,
            session_time: now,
            speed: 0.0,
        };

        let Some(previous) = self.samples.get(&entry.car_idx) else {
            self.samples.insert(entry.car_idx, fresh);

            return 0.0;
        };

        let elapsed = now - previous.session_time;

        // Same tick twice, or the sim paused: nothing moved, keep the estimate.
        if elapsed <= 0.0 {
            return previous.speed as f32;
        }

        let raw =
            wrapped_progress(previous.lap_dist_pct, entry.lap_dist_pct) * track_length_m / elapsed;

        if elapsed > MAX_SAMPLE_GAP_S || !(0.0..=MAX_PLAUSIBLE_SPEED_MPS).contains(&raw) {
            self.samples.insert(entry.car_idx, fresh);

            return 0.0;
        }

        let weight = elapsed / (SMOOTHING_TAU_S + elapsed);
        let seeded = previous.speed <= 0.0;
        let speed = if seeded {
            raw
        } else {
            previous.speed + (raw - previous.speed) * weight
        };

        self.samples
            .insert(entry.car_idx, Sample { speed, ..fresh });

        speed as f32
    }
}

/// Lap fraction covered between two samples, across the start/finish line too.
fn wrapped_progress(from: f32, to: f32) -> f64 {
    let mut diff = f64::from(to) - f64::from(from);

    if diff < -0.5 {
        diff += 1.0;
    }

    if diff > 0.5 {
        diff -= 1.0;
    }

    diff
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::computations::driver_entries::tests::make_live_entry;

    const TRACK_M: f32 = 5000.0;
    const TICK_S: f64 = 0.1;

    fn entry_at(lap_dist_pct: f32) -> DriverEntry {
        make_live_entry(1, 1, 0, lap_dist_pct, TrackSurface::OnTrack)
    }

    fn drive(tracker: &mut CarSpeedTracker, pcts: &[f32]) -> f32 {
        let mut last = 0.0;

        for (tick, pct) in pcts.iter().enumerate() {
            let mut entries = [entry_at(*pct)];
            tracker.apply(&mut entries, Some(tick as f64 * TICK_S), TRACK_M, 0.0);
            last = entries[0].speed;
        }

        last
    }

    #[test]
    fn test_steady_progress_reads_as_its_speed() {
        let mut tracker = CarSpeedTracker::default();
        // 0.001 of 5 km per 0.1 s = 50 m/s
        let speed = drive(&mut tracker, &[0.100, 0.101, 0.102, 0.103]);

        assert!((speed - 50.0).abs() < 0.5, "got {speed}");
    }

    #[test]
    fn test_crossing_the_line_does_not_spike() {
        let mut tracker = CarSpeedTracker::default();
        let speed = drive(&mut tracker, &[0.998, 0.999, 0.000, 0.001]);

        assert!((speed - 50.0).abs() < 0.5, "got {speed}");
    }

    #[test]
    fn test_a_teleport_restarts_the_estimate() {
        let mut tracker = CarSpeedTracker::default();
        let speed = drive(&mut tracker, &[0.100, 0.101, 0.400]);

        assert_eq!(speed, 0.0);
    }

    #[test]
    fn test_the_player_takes_the_real_speed() {
        let mut tracker = CarSpeedTracker::default();
        let mut player = entry_at(0.1);
        player.is_player = true;
        let mut entries = [player];

        tracker.apply(&mut entries, Some(0.0), TRACK_M, 61.5);

        assert_eq!(entries[0].speed, 61.5);
    }
}
