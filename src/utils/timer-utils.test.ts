import { describe, expect, it } from 'vitest';

import { hasRaceStarted, resolveClockUrgency } from './timer-utils';

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
