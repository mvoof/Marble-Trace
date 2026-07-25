import { describe, expect, it } from 'vitest';

import { computeNextStopForecast, formatCountdown } from './fuel-utils';

describe('computeNextStopForecast', () => {
  it('returns null without laps remaining', () => {
    expect(
      computeNextStopForecast({
        lapsRemaining: null,
        pitWindowStart: 12,
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
        pitWarningLaps: 3,
        lapTimeSec: 90,
      })
    ).toBeNull();
  });

  it('counts laps and seconds until the window opens', () => {
    const forecast = computeNextStopForecast({
      lapsRemaining: 9,
      pitWindowStart: 18,
      pitWarningLaps: 3,
      lapTimeSec: 90,
    });

    expect(forecast).toEqual({
      targetLap: 18,
      lapsUntil: 6,
      secondsUntil: 540,
    });
  });

  it('omits the time estimate without a valid lap time', () => {
    const forecast = computeNextStopForecast({
      lapsRemaining: 9,
      pitWindowStart: null,
      pitWarningLaps: 3,
      lapTimeSec: 0,
    });

    expect(forecast).toEqual({
      targetLap: null,
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
