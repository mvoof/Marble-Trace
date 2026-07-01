import { describe, it, expect } from 'vitest';
import {
  advanceDeltaLatch,
  getDisplayedDelta,
  INITIAL_DELTA_LATCH_STATE,
  type DeltaLatchState,
} from './delta-utils';

describe('delta latch', () => {
  it('stays hidden-eligible before any reference lap has ever been valid', () => {
    let state: DeltaLatchState = INITIAL_DELTA_LATCH_STATE;

    // Lap 1: driving with no prior best lap to compare against.
    state = advanceDeltaLatch(state, false, null);
    state = advanceDeltaLatch(state, false, null);

    expect(state.hasHadReference).toBe(false);
    expect(getDisplayedDelta(state, false, null)).toBeNull();
  });

  it('latches "hasHadReference" once the SDK reports a valid delta, and keeps it through a transient OK drop right after setting a new best', () => {
    let state: DeltaLatchState = INITIAL_DELTA_LATCH_STATE;

    // Lap 2: comparing live against lap 1 (the current best) — OK.
    state = advanceDeltaLatch(state, true, 0.5);
    expect(state.hasHadReference).toBe(true);
    expect(getDisplayedDelta(state, true, 0.5)).toBe(0.5);

    state = advanceDeltaLatch(state, true, -0.2);
    expect(getDisplayedDelta(state, true, -0.2)).toBe(-0.2);

    // Lap 2 finishes as a new best. The SDK drops the OK flag for the whole
    // of lap 3 while it re-establishes the comparison — this used to blank
    // the widget/value. It must now keep showing the last known value.
    state = advanceDeltaLatch(state, false, null);
    expect(state.hasHadReference).toBe(true);
    expect(getDisplayedDelta(state, false, null)).toBe(-0.2);

    state = advanceDeltaLatch(state, false, null);
    expect(getDisplayedDelta(state, false, null)).toBe(-0.2);

    // Lap 4: OK resumes, comparing against the new best (lap 2).
    state = advanceDeltaLatch(state, true, 0.1);
    expect(getDisplayedDelta(state, true, 0.1)).toBe(0.1);
  });

  it('does not hide the widget during the transient drop once a reference has been established', () => {
    let state: DeltaLatchState = INITIAL_DELTA_LATCH_STATE;
    const hideWhenNoReference = true;

    state = advanceDeltaLatch(state, true, 0.3);

    const isHiddenDuringTransientDrop =
      hideWhenNoReference &&
      !advanceDeltaLatch(state, false, null).hasHadReference;

    expect(isHiddenDuringTransientDrop).toBe(false);
  });
});
