import { describe, expect, it } from 'vitest';
import type { LapHistoryEntry } from '@/types/bindings';
import {
  DELTA_GAUGE_RANGES,
  DELTA_SLOTS,
  formatDelta,
  getDeltaToPreviousBest,
  resolveGaugeRange,
} from './delta-utils';

describe('formatDelta', () => {
  it.each([null, 0, -0.284, 12.5, -59.999, 62.4, -599.9, 1800, -3599, 7200])(
    'renders %p in exactly DELTA_SLOTS slots',
    (delta) => {
      expect(formatDelta(delta)).toHaveLength(DELTA_SLOTS);
    }
  );

  it('keeps thousandths under a minute', () => {
    expect(formatDelta(0.284)).toBe(' +0.284');
    expect(formatDelta(-12.5)).toBe('-12.500');
  });

  it('drops to tenths past a minute and to seconds past ten', () => {
    expect(formatDelta(62.44).trim()).toBe('+1:02.4');
    expect(formatDelta(-1805).trim()).toBe('-30:05');
  });

  it('collapses anything past an hour', () => {
    expect(formatDelta(7200).trim()).toBe('+>1h');
  });
});

describe('getDeltaToPreviousBest', () => {
  const entry = (lapNum: number, lapTime: number | null): LapHistoryEntry =>
    ({ lapNum, lapTime, delta: null, isBest: false }) as LapHistoryEntry;

  it('compares against the best lap excluding the one just completed', () => {
    const history = [entry(3, 89.1), entry(2, 90.5), entry(1, 91.2)];

    expect(getDeltaToPreviousBest(history, 3, 89.1)).toBeCloseTo(-1.4, 5);
  });

  it('ignores invalidated laps', () => {
    const history = [entry(2, 90.5), entry(1, null)];

    expect(getDeltaToPreviousBest(history, 2, 90.5)).toBeNull();
  });

  it('returns null when there is nothing to compare to', () => {
    expect(getDeltaToPreviousBest([entry(1, 91.2)], 1, 91.2)).toBeNull();
  });
});

describe('resolveGaugeRange', () => {
  it('starts at the tightest range', () => {
    expect(resolveGaugeRange(0.2, DELTA_GAUGE_RANGES[0])).toBe(0.5);
  });

  it('grows straight to the range that fits the delta', () => {
    expect(resolveGaugeRange(3.4, 0.5)).toBe(5);
    expect(resolveGaugeRange(-1.5, 0.5)).toBe(2);
  });

  it('pins at the widest range', () => {
    expect(resolveGaugeRange(45, 0.5)).toBe(10);
  });

  it('holds the current range until the delta drops well inside the next one', () => {
    expect(resolveGaugeRange(0.9, 1)).toBe(1);
    expect(resolveGaugeRange(0.39, 1)).toBe(0.5);
  });

  it('recovers from a range that is no longer on the ladder', () => {
    expect(resolveGaugeRange(0.1, 3)).toBe(0.5);
  });
});
