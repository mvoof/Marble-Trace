import { describe, expect, it } from 'vitest';

import { hasRaceStarted } from './timer-utils';

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
