import { makeAutoObservable, runInAction } from 'mobx';
import { describe, it, expect, beforeEach } from 'vitest';
import { LapStore } from './lap.store';
import type { LapTimingFrame } from '@/types/bindings';

class MockTelemetryStore {
  lapTiming: LapTimingFrame | null = null;
  session: { session_num: number } | null = null;

  constructor() {
    makeAutoObservable(this);
  }
}

const frame = (
  lap: number,
  lap_last_lap_time: number | null = null,
  lap_best_lap_time: number | null = null,
  lap_current_lap_time = 0
): LapTimingFrame =>
  ({
    lap,
    lap_last_lap_time,
    lap_best_lap_time,
    lap_current_lap_time,
  }) as unknown as LapTimingFrame;

const push = (telemetry: MockTelemetryStore, f: LapTimingFrame) => {
  runInAction(() => {
    telemetry.lapTiming = f;
  });
};

describe('LapStore', () => {
  let telemetry: MockTelemetryStore;
  let store: LapStore;

  beforeEach(() => {
    telemetry = new MockTelemetryStore();
    store = new LapStore(telemetry as never);
  });

  it('invalid first lap — records INV', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, null, null));
    // lap time never comes; next lap starts → lap 1 flushed as null
    push(telemetry, frame(3, null, null));

    expect(store.history).toHaveLength(1);
    expect(store.history[0]).toMatchObject({
      lapNum: 1,
      lapTime: null,
      isBest: false,
    });
  });

  it('valid first lap — records time, no delta, isBest=true', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0));

    expect(store.history).toHaveLength(1);
    expect(store.history[0]).toMatchObject({
      lapNum: 1,
      lapTime: 90.0,
      delta: null,
      isBest: true,
    });
  });

  it('valid first, invalid second — records both', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0));
    // lap 2 invalid: time stays then drops to -1
    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(3, null, 90.0));

    expect(store.history).toHaveLength(2);
    expect(store.history[0]).toMatchObject({
      lapNum: 2,
      lapTime: null,
      isBest: false,
    });
    expect(store.history[1]).toMatchObject({
      lapNum: 1,
      lapTime: 90.0,
      isBest: true,
    });
  });

  it('valid first, invalid second, valid third — records all three', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(3, null, 90.0));
    push(telemetry, frame(3, null, 90.0));
    push(telemetry, frame(4, 88.0, 88.0));

    expect(store.history).toHaveLength(3);
    expect(store.history[0]).toMatchObject({
      lapNum: 3,
      lapTime: 88.0,
      delta: null,
      isBest: true,
    });
    expect(store.history[1]).toMatchObject({ lapNum: 2, lapTime: null });
    expect(store.history[2]).toMatchObject({ lapNum: 1, lapTime: 90.0 });
  });

  it('valid first, all subsequent invalid', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0));

    for (let lap = 2; lap <= 5; lap++) {
      push(telemetry, frame(lap, lap === 2 ? 90.0 : null, 90.0));
      push(telemetry, frame(lap + 1, null, 90.0));
    }
    // After the first invalid lap, lastRecordedLapTime becomes -1. Subsequent
    // invalid laps (rawLapTime=-1) match the guard and are deferred until the
    // next lap transition flushes them via the pending path.
    push(telemetry, frame(7, null, 90.0));

    expect(store.history).toHaveLength(5);
    expect(store.history[0]).toMatchObject({ lapNum: 5, lapTime: null });
    expect(store.history[1]).toMatchObject({ lapNum: 4, lapTime: null });
    expect(store.history[2]).toMatchObject({ lapNum: 3, lapTime: null });
    expect(store.history[3]).toMatchObject({ lapNum: 2, lapTime: null });
    expect(store.history[4]).toMatchObject({ lapNum: 1, lapTime: 90.0 });
  });

  it('valid first lap — time arrives one frame after lap change (original bug)', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, null, null)); // lap 1→2, time not yet updated
    push(telemetry, frame(2, 90.0, 90.0)); // same lap, time arrives one frame late

    expect(store.history).toHaveLength(1);
    expect(store.history[0]).toMatchObject({
      lapNum: 1,
      lapTime: 90.0,
      isBest: true,
    });
  });

  it('valid first lap — time arrives two frames after lap change', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, null, null)); // lap 1→2, time not yet updated
    push(telemetry, frame(2, null, null)); // still no time
    push(telemetry, frame(2, 90.0, 90.0)); // time arrives

    expect(store.history).toHaveLength(1);
    expect(store.history[0]).toMatchObject({
      lapNum: 1,
      lapTime: 90.0,
      isBest: true,
    });
  });

  it('valid lap after invalid — not recorded as invalid when lap_last_lap_time still shows -1', () => {
    // Regression: after an invalid lap (rawLapTime=-1), lastRecordedLapTime must
    // be updated to -1. Otherwise the next lap's first frame with stale -1 won't
    // match the guard and will be immediately recorded as invalid instead of waiting.
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0)); // lap 1 = 90.0 recorded

    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(3, null, 90.0)); // lap 2 invalid — rawLapTime=-1

    // lap 3 valid (91.0): first frame after transition still shows stale -1
    push(telemetry, frame(4, null, 90.0)); // lap 3→4 transition, lap_last_lap_time stale (-1)
    push(telemetry, frame(4, 91.0, 90.0)); // lap_last_lap_time now updated to 91.0

    expect(store.history).toHaveLength(3);
    expect(store.history[0]).toMatchObject({
      lapNum: 3,
      lapTime: 91.0,
      isBest: false,
    });
    expect(store.history[1]).toMatchObject({ lapNum: 2, lapTime: null });
    expect(store.history[2]).toMatchObject({
      lapNum: 1,
      lapTime: 90.0,
      isBest: true,
    });
  });

  it('two consecutive invalid laps where both had no prior lap time', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null)); // lap 0→1, skip (completedLapNum=0)
    push(telemetry, frame(2, null, null)); // lap 1→2, pendingLapNum=1
    push(telemetry, frame(3, null, null)); // lap 2→3 → flushes lap 1 as null, sets lap 2 pending
    push(telemetry, frame(4, null, null)); // lap 3→4 → flushes lap 2 as null

    expect(store.history).toHaveLength(2);
    expect(store.history[0]).toMatchObject({ lapNum: 2, lapTime: null });
    expect(store.history[1]).toMatchObject({ lapNum: 1, lapTime: null });
  });

  it('history capped at HISTORY_SIZE (12)', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));

    for (let lap = 1; lap <= 13; lap++) {
      push(telemetry, frame(lap, lap === 1 ? null : 80.0 + lap, 81.0));
      push(telemetry, frame(lap + 1, 80.0 + lap, 81.0));
    }

    expect(store.history).toHaveLength(12);
  });

  it('delta = lapTime - bestLapTime for non-best laps', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(3, 92.0, 90.0));

    expect(store.history[0]).toMatchObject({
      lapNum: 2,
      lapTime: 92.0,
      delta: 2.0,
      isBest: false,
    });
  });

  it('delta float precision', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.1, 90.1));
    push(telemetry, frame(2, 90.1, 90.1));
    push(telemetry, frame(3, 92.6, 90.1));

    expect(store.history[0].delta).toBeCloseTo(2.5, 5);
  });

  it('lap_last_lap_time=0 is treated as not-yet-set, not invalid', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 0, null));
    push(telemetry, frame(2, 90.0, 90.0));

    expect(store.history).toHaveLength(1);
    expect(store.history[0]).toMatchObject({
      lapNum: 1,
      lapTime: 90.0,
      isBest: true,
    });
  });

  it('lap 0 is never recorded', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));

    expect(store.history).toHaveLength(0);
  });

  it('new best lap clears isBest on previous entries', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(3, 88.0, 88.0));

    expect(store.history[0]).toMatchObject({ lapNum: 2, isBest: true });
    expect(store.history[1]).toMatchObject({ lapNum: 1, isBest: false });
  });

  it('restart (lapNum decreases) clears history', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(3, 92.0, 90.0));

    expect(store.history).toHaveLength(2);

    push(telemetry, frame(0, null, null));

    expect(store.history).toHaveLength(0);
    expect(store.lastCompletedLap).toBeNull();
  });

  it('two consecutive laps with equal times — second lap recorded correctly', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0)); // lap 1 recorded: time=90.0

    // lap 2 also runs 90.0; pendingPrevLapTime=90.0 after transition
    push(telemetry, frame(3, 90.0, 90.0, 0.0)); // lap_current_lap_time=0 → wait
    push(telemetry, frame(3, 90.0, 90.0, 0.5)); // still < 1.0 → wait
    push(telemetry, frame(3, 90.0, 90.0, 1.5)); // >= 1.0 → accept equal time

    expect(store.history).toHaveLength(2);
    expect(store.history[0]).toMatchObject({ lapNum: 2, lapTime: 90.0 });
    expect(store.history[1]).toMatchObject({ lapNum: 1, lapTime: 90.0 });
  });

  it('equal lap time — waits until lap_current_lap_time >= 1.0', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(3, 90.0, 90.0, 0.0)); // wait

    expect(store.history).toHaveLength(1); // lap 2 not yet recorded

    push(telemetry, frame(3, 90.0, 90.0, 0.99)); // still < 1.0 → wait
    expect(store.history).toHaveLength(1);

    push(telemetry, frame(3, 90.0, 90.0, 1.0)); // exactly 1.0 → accepted (condition is strict <)
    expect(store.history).toHaveLength(2);
    expect(store.history[0]).toMatchObject({ lapNum: 2, lapTime: 90.0 });
  });

  it('scenario A: lap_last_lap_time updates before lap counter increments — recorded immediately', () => {
    // iRacing sometimes updates lap_last_lap_time one frame BEFORE `lap` increments.
    // The old code used prev.lap_last_lap_time as the "wait" reference, which
    // would equal the NEW time in this scenario and block recording until 1 s passed.
    // The new code uses lastRecordedLapTime (previous recorded lap's time) so
    // the new time is recognised immediately.
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    // lap_last_lap_time already shows T=90.0, but lap counter is still 1
    push(telemetry, frame(1, 90.0, 90.0));
    // now lap counter increments — should record lap 1 on this same frame
    push(telemetry, frame(2, 90.0, 90.0));

    expect(store.history).toHaveLength(1);
    expect(store.history[0]).toMatchObject({
      lapNum: 1,
      lapTime: 90.0,
      isBest: true,
    });
  });

  it('scenario A with best lap: time pre-updates, next lap still recorded correctly', () => {
    // Reported bug: after a best lap, the following lap would sometimes not be
    // recorded (or lag by one lap) because lap_last_lap_time on the transition
    // frame already equalled the best-lap time, triggering the old guard.
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));

    // lap 1 = 90.0 (best)
    push(telemetry, frame(2, 90.0, 90.0));

    // lap 2 finishes with 92.0; scenario A — time arrives one frame early
    push(telemetry, frame(2, 92.0, 90.0)); // lap still 2, time pre-updated
    push(telemetry, frame(3, 92.0, 90.0)); // lap increments — must record immediately

    expect(store.history).toHaveLength(2);
    expect(store.history[0]).toMatchObject({
      lapNum: 2,
      lapTime: 92.0,
      isBest: false,
    });
    expect(store.history[1]).toMatchObject({
      lapNum: 1,
      lapTime: 90.0,
      isBest: true,
    });
  });

  it('session_num change clears history and resets state', () => {
    runInAction(() => {
      telemetry.session = { session_num: 0 };
    });

    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(3, 92.0, 90.0));

    expect(store.history).toHaveLength(2);

    runInAction(() => {
      telemetry.session = { session_num: 1 };
    });

    expect(store.history).toHaveLength(0);
    expect(store.lastCompletedLap).toBeNull();

    // After reset a new outlap + valid lap should be recorded normally.
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 88.0, 88.0));

    expect(store.history).toHaveLength(1);
    expect(store.history[0]).toMatchObject({
      lapNum: 1,
      lapTime: 88.0,
      isBest: true,
    });
  });

  it('lastCompletedLap updates on valid lap, not on INV', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0));

    expect(store.lastCompletedLap).toMatchObject({ lapNum: 1 });

    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(3, null, 90.0));

    expect(store.lastCompletedLap).toMatchObject({ lapNum: 1 });
  });

  it('does not record stale lap time from previous run as Lap 1 after reset', () => {
    // Run 1: Lap 1 is recorded as 90.0
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0)); // Lap 1 recorded as 90.0
    expect(store.history).toHaveLength(1);
    expect(store.history[0]).toMatchObject({ lapNum: 1, lapTime: 90.0 });

    // Reset run: player resets to pits, lap goes back to 1.
    // However, telemetry.lap_last_lap_time STAYS 90.0 (iRacing behavior).
    push(telemetry, frame(1, 90.0, 90.0)); // Reset occurs
    expect(store.history).toHaveLength(0); // History cleared

    // Run 2: outlap (Lap 1) ends, lap counter goes 1 -> 2.
    // Since it's the outlap, lap_last_lap_time does not update and stays 90.0.
    push(telemetry, frame(2, 90.0, 90.0)); // Lap 1 -> 2 transition

    // Lap 1 of the new run should NOT be recorded as 90.0 immediately.
    // It should wait because 90.0 is stale.
    expect(store.history).toHaveLength(0);

    // Then Lap 2 of the new run ends, lap counter goes 2 -> 3.
    // This flushes Lap 1 as invalid (null) and sets Lap 2 pending.
    push(telemetry, frame(3, 90.0, 90.0)); // Lap 2 -> 3 transition, lap_last_lap_time still stale (90.0)
    expect(store.history).toHaveLength(1);
    expect(store.history[0]).toMatchObject({ lapNum: 1, lapTime: null });

    // Then Lap 2's new time (91.0) arrives.
    push(telemetry, frame(3, 91.0, 90.0));
    expect(store.history).toHaveLength(2);
    expect(store.history[0]).toMatchObject({ lapNum: 2, lapTime: 91.0 });
  });

  it('waits to record if current lap time has not reset yet on the transition frame', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0)); // Lap 1 recorded as 90.0
    expect(store.history).toHaveLength(1);

    // Lap 2 in progress
    push(telemetry, frame(2, 90.0, 90.0, 89.0));

    // Lap 2 ends, lap counter changes from 2 -> 3.
    // However, on this first frame, lap_current_lap_time is still showing the end of Lap 2 (92.0),
    // and lap_last_lap_time is still showing Lap 1's time (90.0).
    push(telemetry, frame(3, 90.0, 90.0, 92.0));

    // It should NOT record Lap 2 as 90.0 immediately because current lap time hasn't reset.
    expect(store.history).toHaveLength(1);

    // Next frame: lap_current_lap_time resets to 0.1, and lap_last_lap_time updates to Lap 2's time (91.0).
    push(telemetry, frame(3, 91.0, 90.0, 0.1));

    // It should now correctly record Lap 2 as 91.0!
    expect(store.history).toHaveLength(2);
    expect(store.history[0]).toMatchObject({ lapNum: 2, lapTime: 91.0 });
  });

  it('records lap correctly if telemetry drop out occurs at the start of a lap and resumes on the next lap', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0)); // lap 1 recorded: time=90.0

    // Lap 2 starts. We get one frame at 1.0s:
    push(telemetry, frame(2, 90.0, 90.0, 1.0));

    // Telemetry dropout occurs!
    // We miss the rest of Lap 2 and resume on Lap 3 when current lap time is already 3.0s.
    // The lap_last_lap_time updates to Lap 2's time (e.g. 91.0).
    push(telemetry, frame(3, 91.0, 90.0, 3.0));

    // Lap 2 should be recorded as 91.0 because the time reset happened during the dropout.
    expect(store.history).toHaveLength(2);
    expect(store.history[0]).toMatchObject({
      lapNum: 2,
      lapTime: 91.0,
      isBest: false,
    });
    expect(store.history[1]).toMatchObject({
      lapNum: 1,
      lapTime: 90.0,
      isBest: true,
    });
  });
});
