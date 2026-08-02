import { describe, expect, it } from 'vitest';

import { FUEL_AVG_WINDOW_ALL_LAPS } from '@utils/constants/fuel-constants';
import {
  computeFuelHistoryStats,
  computeLapsToEmpty,
  computeNextStopForecast,
  computeRefuelPlan,
  formatCountdown,
  getFuelStatLabel,
  resolveLapsStatus,
} from './fuel-utils';

describe('computeFuelHistoryStats', () => {
  it('returns nulls for an empty history', () => {
    expect(computeFuelHistoryStats([], 5)).toEqual({
      last: null,
      avg: null,
      min: null,
      max: null,
    });
  });

  it('confines every stat to the configured window', () => {
    // The 9.0 outlier is an out-lap the window deliberately leaves behind.
    const stats = computeFuelHistoryStats([9.0, 2.0, 3.0, 4.0], 3);

    expect(stats).toEqual({ last: 4.0, avg: 3.0, min: 2.0, max: 4.0 });
  });

  it('averages the whole history when the window is all laps', () => {
    const stats = computeFuelHistoryStats(
      [9.0, 2.0, 3.0, 4.0],
      FUEL_AVG_WINDOW_ALL_LAPS
    );

    expect(stats).toEqual({ last: 4.0, avg: 4.5, min: 2.0, max: 9.0 });
  });

  it('falls back to the whole history when the window exceeds it', () => {
    const stats = computeFuelHistoryStats([2.0, 4.0], 10);

    expect(stats).toEqual({ last: 4.0, avg: 3.0, min: 2.0, max: 4.0 });
  });
});

describe('getFuelStatLabel', () => {
  it('names the averaging window in place', () => {
    expect(getFuelStatLabel('avg', 25)).toBe('AVG 25');
    expect(getFuelStatLabel('avg', FUEL_AVG_WINDOW_ALL_LAPS)).toBe('AVG ALL');
  });

  it('keeps static labels for the other stats', () => {
    expect(getFuelStatLabel('last', 25)).toBe('LAST');
    expect(getFuelStatLabel('min', 25)).toBe('MIN');
    expect(getFuelStatLabel('max', 25)).toBe('MAX');
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

describe('computeRefuelPlan', () => {
  it('fills the whole amount when one tank covers it', () => {
    expect(computeRefuelPlan(42.6, 65)).toEqual({ stops: 1, fillNow: 42.6 });
  });

  it('caps this stop at tank capacity instead of splitting evenly', () => {
    // An even split would recommend 47.5 — an amount no real stop takes.
    expect(computeRefuelPlan(142.6, 65)).toEqual({ stops: 3, fillNow: 65 });
  });

  it('returns null when there is nothing to add', () => {
    expect(computeRefuelPlan(null, 65)).toBeNull();
    expect(computeRefuelPlan(0, 65)).toBeNull();
  });

  it('falls back to a single stop without a known capacity', () => {
    expect(computeRefuelPlan(42.6, null)).toEqual({ stops: 1, fillNow: 42.6 });
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
