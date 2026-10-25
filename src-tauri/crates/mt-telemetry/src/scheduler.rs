/// Monotonic-time emit scheduler.
///
/// Sources tick at roughly 60 Hz, but not exactly: iRacing wakes on a Win32
/// event, while other sims poll with `sleep(16ms)` and drift (~58–62 Hz).
/// Throttling by tick count therefore drifts too; this scheduler throttles
/// the 10/4/1 Hz emit groups by elapsed monotonic time instead.
///
/// Publication itself is counted in ticks: a bundle goes out on every
/// `publish_every`-th tick, and the timed groups are only ever due on such a
/// tick. Every bundle is one change of the overlay, and it is the number of
/// changes that costs the game frames (ADR-0009) — a slow tier landing between
/// two published ticks would be one more change, not a cheaper one.
use std::time::{Duration, Instant};

const INTERVAL_10HZ: Duration = Duration::from_millis(100);
const INTERVAL_4HZ: Duration = Duration::from_millis(250);
const INTERVAL_1HZ: Duration = Duration::from_millis(1000);

/// How early a timed group may fire. The groups are checked only on published
/// ticks, which land a whole number of source ticks apart; without slack a 10 Hz
/// interval that is three 30 Hz ticks long would be missed whenever jitter put
/// the third tick a fraction short, and the group would run at 7.5 Hz.
const TIMED_GROUP_SLACK: Duration = Duration::from_millis(4);

/// Which emit groups are due on the current tick.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DueGroups {
    /// True only on the first tick after (re)connect — widgets populate immediately.
    pub first: bool,
    /// A bundle is published on this tick. The processors run on every tick
    /// regardless; only assembling and sending the bundle waits for this.
    pub publish: bool,
    pub hz10: bool,
    pub hz4: bool,
    pub hz1: bool,
}

#[derive(Default)]
pub struct EmitScheduler {
    last_10hz: Option<Instant>,
    last_4hz: Option<Instant>,
    last_1hz: Option<Instant>,
    ticks_since_publish: u32,
}

impl EmitScheduler {
    pub fn new() -> Self {
        Self::default()
    }

    /// Marks due groups and advances their timestamps. The first call after
    /// construction reports every group as due. `publish_every` is the
    /// source-tick divisor of the publication rate: 1 publishes every tick.
    pub fn due(&mut self, now: Instant, publish_every: u32) -> DueGroups {
        let first = self.last_10hz.is_none();
        let publish = first || self.ticks_since_publish + 1 >= publish_every.max(1);

        if !publish {
            self.ticks_since_publish += 1;

            return DueGroups {
                first: false,
                publish: false,
                hz10: false,
                hz4: false,
                hz1: false,
            };
        }

        self.ticks_since_publish = 0;

        DueGroups {
            first,
            publish: true,
            hz10: advance_if_elapsed(&mut self.last_10hz, now, INTERVAL_10HZ),
            hz4: advance_if_elapsed(&mut self.last_4hz, now, INTERVAL_4HZ),
            hz1: advance_if_elapsed(&mut self.last_1hz, now, INTERVAL_1HZ),
        }
    }
}

fn advance_if_elapsed(last: &mut Option<Instant>, now: Instant, interval: Duration) -> bool {
    let elapsed = match last {
        None => true,
        Some(prev) => now.duration_since(*prev) + TIMED_GROUP_SLACK >= interval,
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
    const EVERY_TICK: u32 = 1;
    const EVERY_OTHER_TICK: u32 = 2;
    const TEN_SECONDS_OF_TICKS: usize = 600;

    /// Fired counts of (publish, 10 Hz, 4 Hz, 1 Hz) over `ticks` stable ticks.
    fn counts(publish_every: u32, ticks: usize) -> (u32, u32, u32, u32) {
        let mut scheduler = EmitScheduler::new();
        let mut now = Instant::now();
        let mut counts = (0u32, 0u32, 0u32, 0u32);

        for _ in 0..ticks {
            let due = scheduler.due(now, publish_every);

            counts.0 += due.publish as u32;
            counts.1 += due.hz10 as u32;
            counts.2 += due.hz4 as u32;
            counts.3 += due.hz1 as u32;
            now += STABLE_TICK;
        }

        counts
    }

    #[test]
    fn first_tick_fires_all_groups() {
        let mut scheduler = EmitScheduler::new();
        let due = scheduler.due(Instant::now(), EVERY_OTHER_TICK);

        assert!(due.first && due.publish && due.hz10 && due.hz4 && due.hz1);
    }

    #[test]
    fn stable_60hz_ticks_yield_expected_rates() {
        let (published, hz10, hz4, hz1) = counts(EVERY_TICK, TEN_SECONDS_OF_TICKS);

        assert_eq!(published, 600);
        assert!((95..=105).contains(&hz10), "10Hz fired {hz10} times");
        assert!((38..=42).contains(&hz4), "4Hz fired {hz4} times");
        assert!((10..=11).contains(&hz1), "1Hz fired {hz1} times");
    }

    #[test]
    fn publishing_every_other_tick_keeps_the_timed_groups_at_their_rates() {
        let (published, hz10, hz4, hz1) = counts(EVERY_OTHER_TICK, TEN_SECONDS_OF_TICKS);

        assert_eq!(published, 300);
        assert!((95..=105).contains(&hz10), "10Hz fired {hz10} times");
        assert!((38..=42).contains(&hz4), "4Hz fired {hz4} times");
        assert!((10..=11).contains(&hz1), "1Hz fired {hz1} times");
    }

    #[test]
    fn a_timed_group_is_never_due_off_a_published_tick() {
        let mut scheduler = EmitScheduler::new();
        let mut now = Instant::now();

        for _ in 0..TEN_SECONDS_OF_TICKS {
            let due = scheduler.due(now, 4);

            if due.hz10 || due.hz4 || due.hz1 {
                assert!(due.publish);
            }

            now += STABLE_TICK;
        }
    }

    #[test]
    fn jittery_ticks_never_fire_faster_than_interval_less_the_slack() {
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
            let due = scheduler.due(now, EVERY_TICK);

            if due.hz10 {
                if let Some(prev) = last_10hz_fire {
                    assert!(now.duration_since(prev) + TIMED_GROUP_SLACK >= INTERVAL_10HZ);
                }

                last_10hz_fire = Some(now);
            }

            now += jitter_cycle[tick_index % jitter_cycle.len()];
        }
    }
}
