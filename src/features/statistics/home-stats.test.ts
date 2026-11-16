import { describe, expect, it } from 'vitest';

import type { WeekStats } from '@shared/contracts/generated/bindings';
import {
  changeBetween,
  cleanLapsPercent,
  directionOf,
  personalBestTracks,
} from './home-stats';

const EMPTY_WEEK: WeekStats = {
  timeInCarS: 0,
  km: 0,
  fullLaps: 0,
  cleanLaps: 0,
  races: 0,
  wins: 0,
  podiums: 0,
  topTens: 0,
  personalBests: [],
};

describe('directionOf', () => {
  it('is flat without a change', () => {
    expect([directionOf(12), directionOf(-3), directionOf(0)]).toEqual([
      'up',
      'down',
      'flat',
    ]);
    expect(directionOf(null)).toBe('flat');
  });
});

describe('cleanLapsPercent', () => {
  it('is the clean share of the full laps, none without full laps', () => {
    expect(
      cleanLapsPercent({ ...EMPTY_WEEK, fullLaps: 40, cleanLaps: 35 })
    ).toBe(88);
    expect(cleanLapsPercent(EMPTY_WEEK)).toBeNull();
  });
});

describe('changeBetween', () => {
  it('subtracts, unknown when either side is', () => {
    expect(changeBetween(87, 90)).toBe(-3);
    expect(changeBetween(87, null)).toBeNull();
    expect(changeBetween(null, 90)).toBeNull();
  });
});

describe('personalBestTracks', () => {
  it('names each track once, in the order driven', () => {
    const best = (trackName: string | null) => ({
      trackName,
      carName: 'Car',
      lapTimeS: 100,
    });

    expect(
      personalBestTracks({
        ...EMPTY_WEEK,
        personalBests: [best('Spa'), best('Monza'), best('Spa'), best(null)],
      })
    ).toEqual(['Spa', 'Monza']);
  });
});
