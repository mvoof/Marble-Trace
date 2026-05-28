import { makeAutoObservable, runInAction } from 'mobx';
import { describe, it, expect, beforeEach } from 'vitest';
import { LapStore } from './lap.store';
import type { LapTimingFrame } from '@/types/bindings';

class MockTelemetryStore {
  lapTiming: LapTimingFrame | null = null;
  session = null;

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
    // flush last pending lap (5) via a new lap change
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

  it('lastCompletedLap updates on valid lap, not on INV', () => {
    push(telemetry, frame(0, null, null));
    push(telemetry, frame(1, null, null));
    push(telemetry, frame(2, 90.0, 90.0));

    expect(store.lastCompletedLap).toMatchObject({ lapNum: 1 });

    push(telemetry, frame(2, 90.0, 90.0));
    push(telemetry, frame(3, null, 90.0));

    expect(store.lastCompletedLap).toMatchObject({ lapNum: 1 });
  });
});
