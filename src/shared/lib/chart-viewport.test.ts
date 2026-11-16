import { describe, expect, it, vi } from 'vitest';

import {
  ChartViewport,
  MIN_RANGE_M,
  frameRange,
  longestRun,
  panRange,
  zoomRange,
} from './chart-viewport';

const LAP_M = 4_000;

describe('zoomRange', () => {
  it('narrows around the pointer, keeping it where it was', () => {
    expect(zoomRange(null, LAP_M, 1_000, 0.5)).toEqual([500, 2_500]);
  });

  it('widens back to the whole lap, never past it', () => {
    expect(zoomRange([500, 2_500], LAP_M, 1_000, 2)).toBeNull();
    expect(zoomRange([3_000, 3_900], LAP_M, 3_900, 1.5)).toEqual([
      2_550, 3_900,
    ]);
    expect(zoomRange([3_000, 3_990], LAP_M, 3_000, 1.2)).toEqual([
      2_812, 4_000,
    ]);
  });

  it('stops at the narrowest stretch', () => {
    const range = zoomRange([1_000, 1_030], LAP_M, 1_015, 0.1);

    expect(range && range[1] - range[0]).toBe(MIN_RANGE_M);
  });
});

describe('panRange', () => {
  it('moves the stretch and keeps it on the lap', () => {
    expect(panRange([1_000, 2_000], LAP_M, 500)).toEqual([1_500, 2_500]);
    expect(panRange([1_000, 2_000], LAP_M, -5_000)).toEqual([0, 1_000]);
    expect(panRange(null, LAP_M, 500)).toBeNull();
  });
});

describe('frameRange', () => {
  it('takes the two ends in either order', () => {
    expect(frameRange(2_000, 1_200, LAP_M)).toEqual([1_200, 2_000]);
  });
});

describe('longestRun', () => {
  it('finds the longest stretch inside, the first of equals', () => {
    expect(longestRun([false, true, true, false, true, true, true])).toEqual([
      4, 6,
    ]);
    expect(longestRun([true, true, false, true, true])).toEqual([0, 1]);
    expect(longestRun([false, false])).toBeNull();
  });
});

describe('ChartViewport', () => {
  it('tells its listeners who moved it', () => {
    const viewport = new ChartViewport();
    const onRange = vi.fn();
    const stop = viewport.onRange(onRange);

    viewport.setRange([10, 30], 'map');
    stop();
    viewport.setRange(null, 'chart');

    expect(onRange).toHaveBeenCalledOnce();
    expect(onRange).toHaveBeenCalledWith([10, 30], 'map');
  });

  it('reports a gesture only when it changes', () => {
    const viewport = new ChartViewport();
    const onGesture = vi.fn();
    viewport.onGesture(onGesture);

    viewport.setGesture('pan');
    viewport.setGesture('pan');
    viewport.setGesture(null);

    expect(onGesture.mock.calls).toEqual([['pan'], [null]]);
  });
});
