//! How long each telemetry tick took, for the perf harness.
//!
//! A tick is everything the loop does with one frame once it has it: applying
//! a parsed session, then one pass of `emit_domain_frames` — processors,
//! assembly, mask, quantization and delivery. The samples are kept whole rather than folded
//! into a running histogram, because p99 over a sixty-second run is a sort of
//! a few thousand numbers and nothing cheaper is worth its error.
//!
//! The summary is read only by the perf run, so it exists only in a `dev`
//! build.

use std::time::Duration;

/// Ten minutes at 60 Hz. Past it the oldest half is dropped, so a dev build
/// left running all evening holds a bounded buffer instead of a growing one.
const MAX_SAMPLES: usize = 60 * 60 * 10;

#[cfg(any(feature = "dev", test))]
const WHOLE_PERCENT: u64 = 100;

#[cfg(any(feature = "dev", test))]
/// Tick duration percentiles over the span since the last reset, in
/// microseconds.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickSummary {
    pub ticks: u32,
    pub p50_us: u32,
    pub p99_us: u32,
    pub max_us: u32,
}

#[derive(Default)]
pub struct TickTimings {
    samples_us: Vec<u32>,
}

impl TickTimings {
    pub fn record(&mut self, elapsed: Duration) {
        if self.samples_us.len() >= MAX_SAMPLES {
            self.samples_us.drain(..MAX_SAMPLES / 2);
        }

        self.samples_us
            .push(u32::try_from(elapsed.as_micros()).unwrap_or(u32::MAX));
    }

    pub fn reset(&mut self) {
        self.samples_us.clear();
    }

    #[cfg(any(feature = "dev", test))]
    pub fn summary(&self) -> TickSummary {
        let mut sorted = self.samples_us.clone();
        sorted.sort_unstable();

        TickSummary {
            ticks: u32::try_from(sorted.len()).unwrap_or(u32::MAX),
            p50_us: percentile(&sorted, 50),
            p99_us: percentile(&sorted, 99),
            max_us: sorted.last().copied().unwrap_or(0),
        }
    }
}

#[cfg(any(feature = "dev", test))]
/// Nearest-rank percentile of an already sorted slice; zero when empty.
fn percentile(sorted: &[u32], percent: u32) -> u32 {
    if sorted.is_empty() {
        return 0;
    }

    let rank = (sorted.len() as u64 * u64::from(percent)).div_ceil(WHOLE_PERCENT);
    let index = usize::try_from(rank)
        .unwrap_or(usize::MAX)
        .clamp(1, sorted.len())
        - 1;

    sorted[index]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn timings(micros: &[u64]) -> TickTimings {
        let mut timings = TickTimings::default();

        for value in micros {
            timings.record(Duration::from_micros(*value));
        }

        timings
    }

    #[test]
    fn an_empty_run_reports_zeros() {
        let summary = TickTimings::default().summary();

        assert_eq!(summary.ticks, 0);
        assert_eq!(summary.p50_us, 0);
        assert_eq!(summary.max_us, 0);
    }

    #[test]
    fn percentiles_are_nearest_rank() {
        let values: Vec<u64> = (1..=100).collect();
        let summary = timings(&values).summary();

        assert_eq!(summary.ticks, 100);
        assert_eq!(summary.p50_us, 50);
        assert_eq!(summary.p99_us, 99);
        assert_eq!(summary.max_us, 100);
    }

    #[test]
    fn one_slow_tick_reaches_max_but_not_the_median() {
        let summary = timings(&[100, 100, 100, 5_000]).summary();

        assert_eq!(summary.p50_us, 100);
        assert_eq!(summary.max_us, 5_000);
    }

    #[test]
    fn reset_starts_a_new_run() {
        let mut timings = timings(&[100, 200]);

        timings.reset();

        assert_eq!(timings.summary().ticks, 0);
    }

    #[test]
    fn the_buffer_stays_bounded() {
        let mut timings = TickTimings::default();

        for _ in 0..=MAX_SAMPLES {
            timings.record(Duration::from_micros(1));
        }

        assert!(timings.summary().ticks as usize <= MAX_SAMPLES);
    }
}
