import { describe, expect, it } from 'vitest';

import {
  hasRaceStarted,
  isLapLimitedSession,
  isUnlimitedSessionTime,
  resolveClockUrgency,
  resolveSessionClock,
} from './timer-utils';

describe('hasRaceStarted', () => {
  it('is false while the field is still forming on the grid', () => {
    expect(hasRaceStarted('GetInCar')).toBe(false);
    expect(hasRaceStarted('Warmup')).toBe(false);
    expect(hasRaceStarted('ParadeLaps')).toBe(false);
  });

  it('is true from the green flag onwards', () => {
    expect(hasRaceStarted('Racing')).toBe(true);
    expect(hasRaceStarted('Checkered')).toBe(true);
    expect(hasRaceStarted('CoolDown')).toBe(true);
  });

  it('is false when the session state is unknown', () => {
    expect(hasRaceStarted(null)).toBe(false);
    expect(hasRaceStarted('Invalid')).toBe(false);
  });
});

describe('resolveClockUrgency', () => {
  it('stays normal while the session has plenty of time left', () => {
    expect(resolveClockUrgency(1200)).toBe('normal');
    expect(resolveClockUrgency(301)).toBe('normal');
  });

  it('warns in the last five minutes and turns critical in the last one', () => {
    expect(resolveClockUrgency(300)).toBe('warning');
    expect(resolveClockUrgency(61)).toBe('warning');
    expect(resolveClockUrgency(60)).toBe('critical');
    expect(resolveClockUrgency(0)).toBe('critical');
  });

  it('treats an unknown or elapsed-time clock as normal', () => {
    expect(resolveClockUrgency(null)).toBe('normal');
    expect(resolveClockUrgency(-1)).toBe('normal');
  });
});

const ONE_WEEK_SECONDS = 7 * 24 * 3600;

describe('isUnlimitedSessionTime', () => {
  it('recognises the week iRacing sends for a lap-limited race', () => {
    expect(isUnlimitedSessionTime(ONE_WEEK_SECONDS)).toBe(true);
  });

  it('leaves a real countdown alone, however long', () => {
    expect(isUnlimitedSessionTime(null)).toBe(false);
    expect(isUnlimitedSessionTime(0)).toBe(false);
    expect(isUnlimitedSessionTime(12 * 3600)).toBe(false);
  });
});

describe('resolveSessionClock', () => {
  it('counts the remaining time down while there is a limit', () => {
    expect(resolveSessionClock(1800, 600)).toEqual({
      seconds: 1800,
      isCountdown: true,
    });
  });

  it('counts elapsed time up in a lap race instead of printing the sentinel', () => {
    expect(resolveSessionClock(ONE_WEEK_SECONDS, 754)).toEqual({
      seconds: 754,
      isCountdown: false,
    });
  });

  it('counts up once a timed session runs past its clock', () => {
    expect(resolveSessionClock(-1, 3600)).toEqual({
      seconds: 3600,
      isCountdown: false,
    });
  });

  it('falls back to zero when neither value is known', () => {
    expect(resolveSessionClock(null, null)).toEqual({
      seconds: 0,
      isCountdown: false,
    });
  });
});

describe('isLapLimitedSession', () => {
  it('is true only for a session that ends on a lap count', () => {
    expect(isLapLimitedSession('45')).toBe(true);
    expect(isLapLimitedSession('unlimited')).toBe(false);
    expect(isLapLimitedSession(null)).toBe(false);
    expect(isLapLimitedSession(undefined)).toBe(false);
  });
});

describe('resolveSessionClock in a lap race', () => {
  it('counts up whatever the sim left in the remain field', () => {
    // A day minus one tick is below the sentinel but still not a countdown.
    expect(resolveSessionClock(86399, 42, true)).toEqual({
      seconds: 42,
      isCountdown: false,
    });
    expect(resolveSessionClock(1800, 42, true)).toEqual({
      seconds: 42,
      isCountdown: false,
    });
  });
});
