import { describe, expect, it } from 'vitest';

import type { PitStrategy } from '@shared/contracts/pit-strategy';
import { pitAutoConfigOf } from './pit-auto-config';

const STRATEGY: PitStrategy = {
  pitAutoFuel: true,
  pitAutoTires: false,
  pitAutoTireWearThreshold: 40,
  pitFuelAdjustStep: 5,
};

describe('pitAutoConfigOf', () => {
  it('passes the fuel step through in liters on metric', () => {
    expect(pitAutoConfigOf(STRATEGY, 'metric', true)).toEqual({
      autoFuel: true,
      autoTires: false,
      tireWearThresholdPct: 40,
      fuelStepLiters: 5,
      widgetOnScreen: true,
    });
  });

  it('turns a step of gallons into liters on imperial', () => {
    const config = pitAutoConfigOf(STRATEGY, 'imperial', false);

    expect(config.fuelStepLiters).toBeCloseTo(18.92706);
    expect(config.widgetOnScreen).toBe(false);
  });
});
