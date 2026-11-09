import { describe, expect, it } from 'vitest';

import type { LapHistoryEntry } from '@shared/contracts/generated/bindings';
import {
  averageValidLapTime,
  paceLossFraction,
  paceLossTone,
} from './lap-log-utils';

const lap = (lapNum: number, lapTime: number | null): LapHistoryEntry => ({
  lapNum,
  lapTime,
  delta: null,
  isBest: false,
});

describe('paceLossTone', () => {
  it('reads a few tenths as close and a second as lost', () => {
    expect(paceLossTone(0.433)).toBe('accent');
    expect(paceLossTone(0.5)).toBe('accent');
    expect(paceLossTone(1.276)).toBe('danger');
  });

  it('reads a lap under the best as gained', () => {
    expect(paceLossTone(-0.1)).toBe('positive');
  });
});

describe('paceLossFraction', () => {
  it('grows with the loss and stops at a full bar', () => {
    expect(paceLossFraction(0.9)).toBeCloseTo(0.5);
    expect(paceLossFraction(5)).toBe(1);
  });

  it('draws no bar for a lap that lost nothing', () => {
    expect(paceLossFraction(0)).toBe(0);
    expect(paceLossFraction(-0.3)).toBe(0);
  });
});

describe('averageValidLapTime', () => {
  it('averages only the laps with a time', () => {
    expect(averageValidLapTime([lap(3, 90), lap(2, null), lap(1, 92)])).toEqual(
      { average: 91, count: 2 }
    );
  });

  it('has no average without a timed lap', () => {
    expect(averageValidLapTime([lap(1, null)])).toEqual({
      average: null,
      count: 0,
    });
  });
});
