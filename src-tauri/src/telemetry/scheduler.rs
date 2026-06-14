/// Monotonic-time emit scheduler.
///
/// Sources tick at roughly 60 Hz, but not exactly: iRacing wakes on a Win32
/// event, while other sims poll with `sleep(16ms)` and drift (~58–62 Hz).
/// Throttling by tick count therefore drifts too; this scheduler throttles
/// the 10/4/1 Hz emit groups by elapsed monotonic time instead.
use std::time::{Duration, Instant};

const INTERVAL_10HZ: Duration = Duration::from_millis(100);
const INTERVAL_4HZ: Duration = Duration::from_millis(250);
const INTERVAL_1HZ: Duration = Duration::from_millis(1000);

/// Which emit groups are due on the current tick.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DueGroups {
    /// True only on the first tick after (re)connect — widgets populate immediately.
    pub first: bool,
    pub hz10: bool,
    pub hz4: bool,
    pub hz1: bool,
}

#[derive(Default)]
pub struct EmitScheduler {
    last_10hz: Option<Instant>,
    last_4hz: Option<Instant>,
    last_1hz: Option<Instant>,
}

impl EmitScheduler {
    pub fn new() -> Self {
        Self::default()
    }

    /// Marks due groups and advances their timestamps. The first call after
    /// construction reports every group as due.
    pub fn due(&mut self, now: Instant) -> DueGroups {
        let first = self.last_10hz.is_none();

        DueGroups {
            first,
            hz10: advance_if_elapsed(&mut self.last_10hz, now, INTERVAL_10HZ),
            hz4: advance_if_elapsed(&mut self.last_4hz, now, INTERVAL_4HZ),
            hz1: advance_if_elapsed(&mut self.last_1hz, now, INTERVAL_1HZ),
        }
    }
}

fn advance_if_elapsed(last: &mut Option<Instant>, now: Instant, interval: Duration) -> bool {
    let elapsed = match last {
        None => true,
        Some(prev) => now.duration_since(*prev) >= interval,
    };

    if elapsed {
        *last = Some(now);
    }

    elapsed
}

#[cfg(test)]
mod tests {
    use super::*;

    const STABLE_TICK: Duration = Duration::from_micros(16_667);

    #[test]
    fn first_tick_fires_all_groups() {
        let mut scheduler = EmitScheduler::new();
        let due = scheduler.due(Instant::now());

        assert!(due.first && due.hz10 && due.hz4 && due.hz1);
    }

    #[test]
    fn stable_60hz_ticks_yield_expected_rates() {
        let mut scheduler = EmitScheduler::new();
        let start = Instant::now();
        let mut now = start;
        let mut counts = (0u32, 0u32, 0u32);

        for _ in 0..600 {
            let due = scheduler.due(now);

            counts.0 += due.hz10 as u32;
            counts.1 += due.hz4 as u32;
            counts.2 += due.hz1 as u32;
            now += STABLE_TICK;
        }

        // 600 ticks × ~16.667ms = a 10-second window
        assert!(
            (95..=105).contains(&counts.0),
            "10Hz fired {} times",
            counts.0
        );
        assert!(
            (38..=42).contains(&counts.1),
            "4Hz fired {} times",
            counts.1
        );
        assert!(
            (10..=11).contains(&counts.2),
            "1Hz fired {} times",
            counts.2
        );
    }

    #[test]
    fn jittery_ticks_never_fire_faster_than_interval() {
        let mut scheduler = EmitScheduler::new();
        let mut now = Instant::now();
        let mut last_10hz_fire: Option<Instant> = None;
        let jitter_cycle = [
            Duration::from_millis(13),
            Duration::from_millis(21),
            Duration::from_millis(16),
            Duration::from_millis(18),
        ];

        for tick_index in 0..400 {
            let due = scheduler.due(now);

            if due.hz10 {
                if let Some(prev) = last_10hz_fire {
                    assert!(now.duration_since(prev) >= INTERVAL_10HZ);
                }

                last_10hz_fire = Some(now);
            }

            now += jitter_cycle[tick_index % jitter_cycle.len()];
        }
    }
}
