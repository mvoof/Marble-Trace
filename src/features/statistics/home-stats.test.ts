import { describe, expect, it } from 'vitest';

import type { RatingPoint } from '@shared/contracts/generated/bindings';
import {
  directionOf,
  incidentsPerLap,
  incidentsPerLapChange,
  iratingSteps,
} from './home-stats';

const DAY_S = 24 * 60 * 60;
const NOW_S = 1_000 * DAY_S;

const point = (daysAgo: number, irating: number): RatingPoint => ({
  key: `sub:${daysAgo}`,
  startedAt: NOW_S - daysAgo * DAY_S,
  irating,
  trackName: null,
});

describe('iratingSteps', () => {
  const history = [point(100, 1500), point(40, 1550), point(20, 1520)];

  it('keeps the sessions of the range, each changed against the one before', () => {
    const steps = iratingSteps(history, '30d', NOW_S);

    expect(steps.map((step) => [step.irating, step.change])).toEqual([
      [1520, -30],
    ]);
  });

  it('shows the whole history with no change for the first session', () => {
    const steps = iratingSteps(history, 'all', NOW_S);

    expect(steps.map((step) => step.change)).toEqual([null, 50, -30]);
  });
});

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

describe('incidentsPerLap', () => {
  it('divides the incidents by the laps, none without laps', () => {
    const week = { sessions: 2, races: 1, laps: 40, incidents: 6 };

    expect(incidentsPerLap(week)).toBe(0.15);
    expect(incidentsPerLap({ ...week, laps: 0 })).toBeNull();
  });
});

describe('incidentsPerLapChange', () => {
  it('compares the two spans to two places, none without laps in either', () => {
    const week = { sessions: 2, races: 1, laps: 40, incidents: 6 };
    const previousWeek = { ...week, laps: 50, incidents: 6 };

    expect(incidentsPerLapChange(week, previousWeek)).toBe(0.03);
    expect(incidentsPerLapChange(week, { ...week, laps: 0 })).toBeNull();
  });
});
