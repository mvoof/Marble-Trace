/// Lap log processor — mirrors the frontend `LapStore` state machine.
///
/// Tracks lap completion events, handles iRacing SDK quirks around
/// `lap_last_lap_time` delivery timing, and maintains a capped history
/// of completed laps for the player.
use crate::capabilities::Capabilities;
use crate::computations::{ComputeContext, ComputedOutput, Processor, ProcessorId, TickRate};
use crate::model::lap_log::{LapHistoryEntry, LapLogFrame, LastCompletedLap};

const HISTORY_SIZE: usize = 12;

/// Internal state for the lap log processor.
#[derive(Debug, Default)]
pub struct LapLogProcessor {
    state: LapLogState,
}

#[derive(Debug)]
struct LapLogState {
    history: Vec<LapHistoryEntry>,
    last_completed_lap: Option<LastCompletedLap>,

    /// Previous frame's lap number — used to detect lap counter transitions.
    prev_lap_num: Option<i32>,
    /// Previous frame's `lap_current_lap_time` — used to detect the clock reset.
    prev_current_lap_time: f32,
    /// Previous frame's session_num — triggers a full reset on session change.
    prev_session_num: Option<i32>,

    /// Lap number whose time we are waiting to confirm from `lap_last_lap_time`.
    pending_lap_num: Option<i32>,

    /// Time of the most recently *written* history entry. Used instead of the
    /// previous frame's `lap_last_lap_time` to avoid the iRacing quirk where the
    /// SDK sometimes updates `lap_last_lap_time` one frame BEFORE `lap` increments.
    last_recorded_lap_time: f32,

    /// Set to `true` once we observe that `lap_current_lap_time` has reset (gone
    /// below 2 s, or dropped vs the previous frame). Guards against recording the
    /// wrong lap time on the first frames after a lap transition.
    time_reset_received: bool,
}

impl Default for LapLogState {
    fn default() -> Self {
        Self {
            history: Vec::new(),
            last_completed_lap: None,
            prev_lap_num: None,
            prev_current_lap_time: 0.0,
            prev_session_num: None,
            pending_lap_num: None,
            last_recorded_lap_time: -1.0,
            time_reset_received: true,
        }
    }
}

impl LapLogState {
    fn reset(&mut self) {
        self.history.clear();
        self.last_completed_lap = None;
        self.pending_lap_num = None;
        self.last_recorded_lap_time = -1.0;
        self.time_reset_received = true;
    }

    fn reset_with_frame(&mut self, lap_last_lap_time: f32) {
        self.reset();
        self.last_recorded_lap_time = lap_last_lap_time;
        self.time_reset_received = true;
    }

    fn push_history(&mut self, entry: LapHistoryEntry) {
        if entry.is_best {
            for existing in &mut self.history {
                existing.is_best = false;
            }
        }

        self.history.insert(0, entry);
        self.history.truncate(HISTORY_SIZE);
    }

    /// Process one `LapTimingFrame` worth of data and return an updated `LapLogFrame`.
    pub fn update(
        &mut self,
        lap_num: i32,
        lap_current_lap_time: f32,
        lap_last_lap_time: f32,
        lap_best_lap_time: f32,
        session_num: Option<i32>,
    ) -> LapLogFrame {
        // --- Session-change reset ---
        if session_num != self.prev_session_num {
            if self.prev_session_num.is_some() {
                self.reset();
                self.last_recorded_lap_time = lap_last_lap_time;
                self.time_reset_received = true;
            }

            self.prev_session_num = session_num;
        }

        let prev_lap_num = self.prev_lap_num.unwrap_or(lap_num);
        let prev_current_lap_time = self.prev_current_lap_time;

        self.prev_lap_num = Some(lap_num);
        self.prev_current_lap_time = lap_current_lap_time;

        // First-ever frame — initialise and return current state.
        if self.prev_lap_num == Some(lap_num) && prev_lap_num == lap_num {
            // Handled below — but we need the very first frame to seed last_recorded_lap_time.
            // Already set via session_num guard above; nothing extra needed.
        }

        // --- Lap counter went backwards → session reset or restart ---
        if lap_num < prev_lap_num {
            self.reset_with_frame(lap_last_lap_time);

            return self.current_frame();
        }

        // --- Lap counter incremented ---
        if lap_num > prev_lap_num {
            let completed_lap_num = lap_num - 1;

            // Outlap just ended — no time to record.
            if completed_lap_num == 0 {
                // Clear pending if any (shouldn't happen, but defensive).
                self.pending_lap_num = None;
                self.time_reset_received = false;

                return self.current_frame();
            }

            // A previously pending lap that never resolved — flush as invalid.
            if let Some(unflushed_lap_num) = self.pending_lap_num.take() {
                let entry = LapHistoryEntry {
                    lap_num: unflushed_lap_num,
                    lap_time: None,
                    delta: None,
                    is_best: false,
                };

                self.push_history(entry);
            }

            self.pending_lap_num = Some(completed_lap_num);
            self.time_reset_received = false;
        }

        // --- Resolve the pending lap ---
        if self.pending_lap_num.is_some() {
            // Detect if `lap_current_lap_time` has reset to the start of the new lap.
            if lap_current_lap_time < 2.0
                || lap_current_lap_time < prev_current_lap_time
                || prev_current_lap_time < 2.0
            {
                self.time_reset_received = true;
            }

            if !self.time_reset_received {
                return self.current_frame();
            }

            // `0` means `lap_last_lap_time` is not yet initialised — keep waiting.
            if lap_last_lap_time == 0.0 {
                return self.current_frame();
            }

            // `lap_last_lap_time` still shows the previous lap's time — SDK hasn't
            // updated yet. Keep waiting unless >1 s has elapsed (same-time guard).
            if lap_last_lap_time == self.last_recorded_lap_time && lap_current_lap_time < 1.0 {
                return self.current_frame();
            }

            let completed_lap_num = self.pending_lap_num.unwrap();

            // Negative → lap invalidated (pit, SC, penalty, reset).
            if lap_last_lap_time < 0.0 {
                self.pending_lap_num = None;
                self.last_recorded_lap_time = lap_last_lap_time;

                let entry = LapHistoryEntry {
                    lap_num: completed_lap_num,
                    lap_time: None,
                    delta: None,
                    is_best: false,
                };

                self.push_history(entry);

                return self.current_frame();
            }

            // Valid lap time — record it.
            let lap_time = lap_last_lap_time;

            self.pending_lap_num = None;
            self.last_recorded_lap_time = lap_time;

            let is_best = lap_best_lap_time > 0.0 && lap_time == lap_best_lap_time;
            let delta = if lap_best_lap_time > 0.0 && !is_best {
                Some(lap_time - lap_best_lap_time)
            } else {
                None
            };

            self.last_completed_lap = Some(LastCompletedLap {
                lap_num: completed_lap_num,
                delta,
            });

            let entry = LapHistoryEntry {
                lap_num: completed_lap_num,
                lap_time: Some(lap_time),
                delta,
                is_best,
            };

            self.push_history(entry);
        }

        self.current_frame()
    }

    fn current_frame(&self) -> LapLogFrame {
        LapLogFrame {
            history: self.history.clone(),
            last_completed_lap: self.last_completed_lap.clone(),
        }
    }
}

impl Processor for LapLogProcessor {
    fn id(&self) -> ProcessorId {
        ProcessorId::LapLog
    }

    fn required(&self) -> Capabilities {
        Capabilities::empty()
    }

    fn rate(&self) -> TickRate {
        TickRate::Hz4
    }

    fn compute(&mut self, ctx: &ComputeContext) -> Option<ComputedOutput> {
        let lap_num = ctx.lap_timing.lap.unwrap_or(0);
        let lap_current_lap_time = ctx.lap_timing.lap_current_lap_time;
        let lap_last_lap_time = ctx.lap_timing.lap_last_lap_time.unwrap_or(-1.0);
        let lap_best_lap_time = ctx.lap_timing.lap_best_lap_time.unwrap_or(0.0);

        let frame = self.state.update(
            lap_num,
            lap_current_lap_time,
            lap_last_lap_time,
            lap_best_lap_time,
            ctx.session_num,
        );

        Some(ComputedOutput::LapLog(frame))
    }

    fn reset(&mut self) {
        self.state.reset();
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: construct a minimal state and push one data frame through it.
    fn push(
        state: &mut LapLogState,
        lap: i32,
        lap_last_lap_time: f32,
        lap_best_lap_time: f32,
        lap_current_lap_time: f32,
        session_num: Option<i32>,
    ) -> LapLogFrame {
        state.update(
            lap,
            lap_current_lap_time,
            lap_last_lap_time,
            lap_best_lap_time,
            session_num,
        )
    }

    /// Shorthand — no session, current_lap_time = 0.
    fn p(state: &mut LapLogState, lap: i32, last: f32, best: f32) -> LapLogFrame {
        push(state, lap, last, best, 0.0, None)
    }

    fn new_state() -> LapLogState {
        LapLogState::default()
    }

    #[test]
    fn invalid_first_lap_records_inv() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, -1.0, 0.0);
        // lap time never comes; next lap starts → lap 1 flushed as null
        let frame = p(&mut s, 3, -1.0, 0.0);

        assert_eq!(frame.history.len(), 1);
        assert_eq!(frame.history[0].lap_num, 1);
        assert_eq!(frame.history[0].lap_time, None);
        assert!(!frame.history[0].is_best);
    }

    #[test]
    fn valid_first_lap_records_time_no_delta_is_best_true() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        let frame = p(&mut s, 2, 90.0, 90.0);

        assert_eq!(frame.history.len(), 1);
        assert_eq!(frame.history[0].lap_num, 1);
        assert_eq!(frame.history[0].lap_time, Some(90.0));
        assert_eq!(frame.history[0].delta, None);
        assert!(frame.history[0].is_best);
    }

    #[test]
    fn valid_first_invalid_second_records_both() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0);
        // lap 2 invalid: time stays then drops to -1
        p(&mut s, 2, 90.0, 90.0);
        let frame = p(&mut s, 3, -1.0, 90.0);

        assert_eq!(frame.history.len(), 2);
        assert_eq!(frame.history[0].lap_num, 2);
        assert_eq!(frame.history[0].lap_time, None);
        assert!(!frame.history[0].is_best);
        assert_eq!(frame.history[1].lap_num, 1);
        assert_eq!(frame.history[1].lap_time, Some(90.0));
        assert!(frame.history[1].is_best);
    }

    #[test]
    fn valid_first_invalid_second_valid_third_records_all_three() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0);
        p(&mut s, 2, 90.0, 90.0);
        p(&mut s, 3, -1.0, 90.0);
        p(&mut s, 3, -1.0, 90.0);
        let frame = p(&mut s, 4, 88.0, 88.0);

        assert_eq!(frame.history.len(), 3);
        assert_eq!(frame.history[0].lap_num, 3);
        assert_eq!(frame.history[0].lap_time, Some(88.0));
        assert_eq!(frame.history[0].delta, None);
        assert!(frame.history[0].is_best);
        assert_eq!(frame.history[1].lap_num, 2);
        assert_eq!(frame.history[1].lap_time, None);
        assert_eq!(frame.history[2].lap_num, 1);
        assert_eq!(frame.history[2].lap_time, Some(90.0));
    }

    #[test]
    fn valid_first_all_subsequent_invalid() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0);

        for lap in 2..=5_i32 {
            let last = if lap == 2 { 90.0 } else { -1.0 };
            p(&mut s, lap, last, 90.0);
            p(&mut s, lap + 1, -1.0, 90.0);
        }

        let frame = p(&mut s, 7, -1.0, 90.0);

        assert_eq!(frame.history.len(), 5);
        assert_eq!(frame.history[0].lap_num, 5);
        assert_eq!(frame.history[0].lap_time, None);
        assert_eq!(frame.history[1].lap_num, 4);
        assert_eq!(frame.history[1].lap_time, None);
        assert_eq!(frame.history[2].lap_num, 3);
        assert_eq!(frame.history[2].lap_time, None);
        assert_eq!(frame.history[3].lap_num, 2);
        assert_eq!(frame.history[3].lap_time, None);
        assert_eq!(frame.history[4].lap_num, 1);
        assert_eq!(frame.history[4].lap_time, Some(90.0));
    }

    #[test]
    fn time_arrives_one_frame_after_lap_change() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, -1.0, 0.0); // lap 1→2, time not yet updated
        let frame = p(&mut s, 2, 90.0, 90.0); // same lap, time arrives one frame late

        assert_eq!(frame.history.len(), 1);
        assert_eq!(frame.history[0].lap_num, 1);
        assert_eq!(frame.history[0].lap_time, Some(90.0));
        assert!(frame.history[0].is_best);
    }

    #[test]
    fn time_arrives_two_frames_after_lap_change() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, -1.0, 0.0); // lap 1→2
        p(&mut s, 2, -1.0, 0.0); // still no time
        let frame = p(&mut s, 2, 90.0, 90.0); // arrives

        assert_eq!(frame.history.len(), 1);
        assert_eq!(frame.history[0].lap_num, 1);
        assert_eq!(frame.history[0].lap_time, Some(90.0));
        assert!(frame.history[0].is_best);
    }

    #[test]
    fn valid_lap_after_invalid_not_recorded_as_invalid_when_time_stale() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0); // lap 1 = 90.0

        p(&mut s, 2, 90.0, 90.0);
        p(&mut s, 3, -1.0, 90.0); // lap 2 invalid

        // lap 3 valid (91.0): first frame still shows stale -1
        p(&mut s, 4, -1.0, 90.0); // transition, stale
        let frame = p(&mut s, 4, 91.0, 90.0); // time updated

        assert_eq!(frame.history.len(), 3);
        assert_eq!(frame.history[0].lap_num, 3);
        assert_eq!(frame.history[0].lap_time, Some(91.0));
        assert!(!frame.history[0].is_best);
        assert_eq!(frame.history[1].lap_num, 2);
        assert_eq!(frame.history[1].lap_time, None);
        assert_eq!(frame.history[2].lap_num, 1);
        assert_eq!(frame.history[2].lap_time, Some(90.0));
        assert!(frame.history[2].is_best);
    }

    #[test]
    fn two_consecutive_invalid_laps_no_prior_lap_time() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0); // lap 0→1, skip (completed=0)
        p(&mut s, 2, -1.0, 0.0); // lap 1→2, pending=1
        p(&mut s, 3, -1.0, 0.0); // lap 2→3 → flush lap 1 as null, pending=2
        let frame = p(&mut s, 4, -1.0, 0.0); // lap 3→4 → flush lap 2 as null

        assert_eq!(frame.history.len(), 2);
        assert_eq!(frame.history[0].lap_num, 2);
        assert_eq!(frame.history[0].lap_time, None);
        assert_eq!(frame.history[1].lap_num, 1);
        assert_eq!(frame.history[1].lap_time, None);
    }

    #[test]
    fn history_capped_at_history_size() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);

        let mut frame = LapLogFrame {
            history: vec![],
            last_completed_lap: None,
        };

        for lap in 1..=13_i32 {
            let last = if lap == 1 { -1.0 } else { 80.0 + lap as f32 };
            p(&mut s, lap, last, 81.0);
            frame = p(&mut s, lap + 1, 80.0 + lap as f32, 81.0);
        }

        assert_eq!(frame.history.len(), HISTORY_SIZE);
    }

    #[test]
    fn delta_equals_lap_time_minus_best_for_non_best_laps() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0);
        p(&mut s, 2, 90.0, 90.0);
        let frame = p(&mut s, 3, 92.0, 90.0);

        assert_eq!(frame.history[0].lap_num, 2);
        assert_eq!(frame.history[0].lap_time, Some(92.0));
        assert!(!frame.history[0].is_best);
        let delta = frame.history[0].delta.expect("delta should be Some");
        assert!((delta - 2.0).abs() < 1e-5, "delta = {delta}");
    }

    #[test]
    fn delta_float_precision() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.1, 90.1);
        p(&mut s, 2, 90.1, 90.1);
        let frame = p(&mut s, 3, 92.6, 90.1);

        let delta = frame.history[0].delta.expect("delta should be Some");
        assert!((delta - 2.5).abs() < 1e-4, "delta = {delta}");
    }

    #[test]
    fn lap_last_lap_time_zero_treated_as_not_yet_set() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 0.0, 0.0); // 0 = not initialised
        let frame = p(&mut s, 2, 90.0, 90.0);

        assert_eq!(frame.history.len(), 1);
        assert_eq!(frame.history[0].lap_num, 1);
        assert_eq!(frame.history[0].lap_time, Some(90.0));
        assert!(frame.history[0].is_best);
    }

    #[test]
    fn lap_0_never_recorded() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        let frame = p(&mut s, 1, -1.0, 0.0);

        assert_eq!(frame.history.len(), 0);
    }

    #[test]
    fn new_best_lap_clears_is_best_on_previous_entries() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0);
        p(&mut s, 2, 90.0, 90.0);
        let frame = p(&mut s, 3, 88.0, 88.0);

        assert_eq!(frame.history[0].lap_num, 2);
        assert!(frame.history[0].is_best);
        assert_eq!(frame.history[1].lap_num, 1);
        assert!(!frame.history[1].is_best);
    }

    #[test]
    fn restart_clears_history() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0);
        p(&mut s, 2, 90.0, 90.0);
        p(&mut s, 3, 92.0, 90.0);

        assert_eq!(s.history.len(), 2);

        let frame = p(&mut s, 0, -1.0, 0.0);

        assert_eq!(frame.history.len(), 0);
        assert!(frame.last_completed_lap.is_none());
    }

    #[test]
    fn two_consecutive_equal_times_second_recorded_correctly() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0); // lap 1 = 90.0

        // lap 2 also 90.0; same-time guard: wait until current_lap_time >= 1.0
        push(&mut s, 3, 90.0, 90.0, 0.0, None); // current_lap=0 → wait
        push(&mut s, 3, 90.0, 90.0, 0.5, None); // still < 1.0 → wait
        let frame = push(&mut s, 3, 90.0, 90.0, 1.5, None); // >= 1.0 → accept

        assert_eq!(frame.history.len(), 2);
        assert_eq!(frame.history[0].lap_num, 2);
        assert_eq!(frame.history[0].lap_time, Some(90.0));
    }

    #[test]
    fn equal_lap_time_waits_until_current_lap_time_ge_1() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0); // lap 1

        push(&mut s, 3, 90.0, 90.0, 0.0, None); // wait

        assert_eq!(s.history.len(), 1);

        push(&mut s, 3, 90.0, 90.0, 0.99, None);
        assert_eq!(s.history.len(), 1);

        let frame = push(&mut s, 3, 90.0, 90.0, 1.0, None); // strictly < 1.0 fails
        assert_eq!(frame.history.len(), 2);
        assert_eq!(frame.history[0].lap_num, 2);
        assert_eq!(frame.history[0].lap_time, Some(90.0));
    }

    #[test]
    fn scenario_a_lap_last_lap_time_updates_before_lap_counter() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 1, 90.0, 90.0); // time pre-updates before lap increments
        let frame = p(&mut s, 2, 90.0, 90.0); // lap increments — record immediately

        assert_eq!(frame.history.len(), 1);
        assert_eq!(frame.history[0].lap_num, 1);
        assert_eq!(frame.history[0].lap_time, Some(90.0));
        assert!(frame.history[0].is_best);
    }

    #[test]
    fn scenario_a_with_best_lap_next_lap_recorded_correctly() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0); // lap 1 = 90.0 (best)

        // lap 2 = 92.0; scenario A — time arrives one frame early
        p(&mut s, 2, 92.0, 90.0); // still lap 2, time pre-updated
        let frame = p(&mut s, 3, 92.0, 90.0); // lap increments — record immediately

        assert_eq!(frame.history.len(), 2);
        assert_eq!(frame.history[0].lap_num, 2);
        assert_eq!(frame.history[0].lap_time, Some(92.0));
        assert!(!frame.history[0].is_best);
        assert_eq!(frame.history[1].lap_num, 1);
        assert_eq!(frame.history[1].lap_time, Some(90.0));
        assert!(frame.history[1].is_best);
    }

    #[test]
    fn session_num_change_clears_history_and_resets_state() {
        let mut s = new_state();

        push(&mut s, 0, -1.0, 0.0, 0.0, Some(0));
        push(&mut s, 1, -1.0, 0.0, 0.0, Some(0));
        push(&mut s, 2, 90.0, 90.0, 0.0, Some(0));
        push(&mut s, 2, 90.0, 90.0, 0.0, Some(0));
        push(&mut s, 3, 92.0, 90.0, 0.0, Some(0));

        assert_eq!(s.history.len(), 2);

        push(&mut s, 3, 92.0, 90.0, 0.0, Some(1)); // session change

        assert_eq!(s.history.len(), 0);
        assert!(s.last_completed_lap.is_none());

        // New run after reset
        push(&mut s, 0, -1.0, 0.0, 0.0, Some(1));
        push(&mut s, 1, -1.0, 0.0, 0.0, Some(1));
        let frame = push(&mut s, 2, 88.0, 88.0, 0.0, Some(1));

        assert_eq!(frame.history.len(), 1);
        assert_eq!(frame.history[0].lap_num, 1);
        assert_eq!(frame.history[0].lap_time, Some(88.0));
        assert!(frame.history[0].is_best);
    }

    #[test]
    fn last_completed_lap_updates_on_valid_not_on_inv() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        let frame = p(&mut s, 2, 90.0, 90.0);

        assert!(frame.last_completed_lap.is_some());
        assert_eq!(frame.last_completed_lap.as_ref().unwrap().lap_num, 1);

        p(&mut s, 2, 90.0, 90.0);
        let frame2 = p(&mut s, 3, -1.0, 90.0); // invalid

        assert_eq!(frame2.last_completed_lap.as_ref().unwrap().lap_num, 1);
    }

    #[test]
    fn does_not_record_stale_lap_time_from_previous_run_after_reset() {
        let mut s = new_state();

        // Run 1: lap 1 = 90.0
        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0);
        assert_eq!(s.history.len(), 1);

        // Reset: lap goes back to 1, lap_last_lap_time stays at 90.0
        p(&mut s, 1, 90.0, 90.0);
        assert_eq!(s.history.len(), 0);

        // Run 2 outlap ends, lap_last_lap_time still stale (90.0)
        p(&mut s, 2, 90.0, 90.0);
        assert_eq!(s.history.len(), 0);

        // Lap 2→3 transition: flush lap 1 as null
        p(&mut s, 3, 90.0, 90.0);
        assert_eq!(s.history.len(), 1);
        assert_eq!(s.history[0].lap_num, 1);
        assert_eq!(s.history[0].lap_time, None);

        // Lap 2's real time (91.0) arrives
        let frame = p(&mut s, 3, 91.0, 90.0);
        assert_eq!(frame.history.len(), 2);
        assert_eq!(frame.history[0].lap_num, 2);
        assert_eq!(frame.history[0].lap_time, Some(91.0));
    }

    #[test]
    fn waits_to_record_if_current_lap_time_has_not_reset_on_transition_frame() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0); // lap 1 = 90.0
        assert_eq!(s.history.len(), 1);

        push(&mut s, 2, 90.0, 90.0, 89.0, None); // lap 2 in progress

        // Lap 2 ends; current_lap_time still shows 92.0 (end of lap 2), last still 90.0
        push(&mut s, 3, 90.0, 90.0, 92.0, None);
        assert_eq!(s.history.len(), 1); // NOT yet recorded

        // Next frame: current resets to 0.1, last updates to 91.0
        let frame = push(&mut s, 3, 91.0, 90.0, 0.1, None);
        assert_eq!(frame.history.len(), 2);
        assert_eq!(frame.history[0].lap_num, 2);
        assert_eq!(frame.history[0].lap_time, Some(91.0));
    }

    #[test]
    fn records_lap_correctly_after_telemetry_dropout() {
        let mut s = new_state();

        p(&mut s, 0, -1.0, 0.0);
        p(&mut s, 1, -1.0, 0.0);
        p(&mut s, 2, 90.0, 90.0); // lap 1 = 90.0

        // One frame of lap 2 at 1.0s
        push(&mut s, 2, 90.0, 90.0, 1.0, None);

        // Dropout! Resume on lap 3, current=3.0, last=91.0
        let frame = push(&mut s, 3, 91.0, 90.0, 3.0, None);

        assert_eq!(frame.history.len(), 2);
        assert_eq!(frame.history[0].lap_num, 2);
        assert_eq!(frame.history[0].lap_time, Some(91.0));
        assert!(!frame.history[0].is_best);
        assert_eq!(frame.history[1].lap_num, 1);
        assert_eq!(frame.history[1].lap_time, Some(90.0));
        assert!(frame.history[1].is_best);
    }
}
