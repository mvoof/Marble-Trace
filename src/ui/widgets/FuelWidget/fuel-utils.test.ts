import { describe, expect, it } from 'vitest';

import type { FuelLapRecord } from '@/types/bindings';
import { FUEL_AVG_WINDOW_ALL_LAPS } from '@utils/fuel-constants';
import {
  countedLaps,
  computeLapsToEmpty,
  computeNextStopForecast,
  formatCountdown,
  getFuelStatLabel,
  getSummaryAvgLabel,
  isPitNow,
  resolveLapsStatus,
} from './fuel-utils';

describe('countedLaps', () => {
  it('keeps the laps that count, in order', () => {
    const history: FuelLapRecord[] = [
      { lap: 4, used: 2.0, rejected: null },
      { lap: 5, used: 0.4, rejected: 'caution' },
      { lap: 6, used: 2.2, rejected: null },
    ];

    expect(countedLaps(history).map((record) => record.lap)).toEqual([4, 6]);
  });
});

describe('getFuelStatLabel', () => {
  it('labels the average column as the whole history', () => {
    expect(getFuelStatLabel('avg')).toBe('AVG ALL');
  });

  it('keeps static labels for the other stats', () => {
    expect(getFuelStatLabel('last')).toBe('LAST');
    expect(getFuelStatLabel('min')).toBe('MIN');
    expect(getFuelStatLabel('max')).toBe('MAX');
  });
});

describe('getSummaryAvgLabel', () => {
  it('names the window driving the strategy figures', () => {
    expect(getSummaryAvgLabel(5)).toBe('AVG 5');
    expect(getSummaryAvgLabel(FUEL_AVG_WINDOW_ALL_LAPS)).toBe('AVG ALL');
  });
});

describe('isPitNow', () => {
  it('drops the lap range once under a lap of fuel is left', () => {
    expect(isPitNow(1)).toBe(true);
    expect(isPitNow(0.3)).toBe(true);
  });

  it('keeps the range while the window still has laps to offer', () => {
    expect(isPitNow(1.1)).toBe(false);
    expect(isPitNow(3)).toBe(false);
  });

  it('stays quiet without a reading', () => {
    expect(isPitNow(null)).toBe(false);
  });
});

describe('computeLapsToEmpty', () => {
  it('divides the tank by the consumption', () => {
    expect(computeLapsToEmpty(28, 2.8)).toBe(10);
  });

  it('returns null for missing or non-positive inputs', () => {
    expect(computeLapsToEmpty(null, 2.8)).toBeNull();
    expect(computeLapsToEmpty(28, null)).toBeNull();
    expect(computeLapsToEmpty(28, 0)).toBeNull();
    expect(computeLapsToEmpty(0, 2.8)).toBeNull();
  });
});

describe('resolveLapsStatus', () => {
  it('flags danger once the window is open', () => {
    expect(resolveLapsStatus(3, 3)).toBe('danger');
    expect(resolveLapsStatus(2.5, 3)).toBe('danger');
  });

  it('warns inside the buffer above the window', () => {
    expect(resolveLapsStatus(4, 3)).toBe('warning');
    expect(resolveLapsStatus(5, 3)).toBe('warning');
  });

  it('is safe beyond the buffer', () => {
    expect(resolveLapsStatus(5.1, 3)).toBe('safe');
  });

  it('returns null without a reading', () => {
    expect(resolveLapsStatus(null, 3)).toBeNull();
  });
});

describe('computeNextStopForecast', () => {
  it('returns null without laps remaining', () => {
    expect(
      computeNextStopForecast({
        lapsRemaining: null,
        pitWindowStart: 12,
        pitWindowEnd: 16,
        pitWarningLaps: 3,
        lapTimeSec: 90,
      })
    ).toBeNull();
  });

  it('returns null once the pit window is already open', () => {
    expect(
      computeNextStopForecast({
        lapsRemaining: 2.5,
        pitWindowStart: 12,
        pitWindowEnd: 16,
        pitWarningLaps: 3,
        lapTimeSec: 90,
      })
    ).toBeNull();
  });

  it('counts laps and seconds until the window opens', () => {
    const forecast = computeNextStopForecast({
      lapsRemaining: 9,
      pitWindowStart: 18,
      pitWindowEnd: 22,
      pitWarningLaps: 3,
      lapTimeSec: 90,
    });

    expect(forecast).toEqual({
      targetLap: 18,
      windowEndLap: 22,
      lapsUntil: 6,
      secondsUntil: 540,
    });
  });

  it('omits the time estimate without a valid lap time', () => {
    const forecast = computeNextStopForecast({
      lapsRemaining: 9,
      pitWindowStart: null,
      pitWindowEnd: null,
      pitWarningLaps: 3,
      lapTimeSec: 0,
    });

    expect(forecast).toEqual({
      targetLap: null,
      windowEndLap: null,
      lapsUntil: 6,
      secondsUntil: null,
    });
  });
});

describe('formatCountdown', () => {
  it('formats minutes and seconds', () => {
    expect(formatCountdown(540)).toBe('9:00');
    expect(formatCountdown(65.4)).toBe('1:05');
  });

  it('formats hours when needed', () => {
    expect(formatCountdown(3725)).toBe('1:02:05');
  });

  it('clamps negatives to zero', () => {
    expect(formatCountdown(-5)).toBe('0:00');
  });
});
