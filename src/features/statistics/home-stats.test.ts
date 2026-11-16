import { describe, expect, it } from 'vitest';

import {
  directionOf,
  incidentsPerLap,
  incidentsPerLapChange,
} from './home-stats';

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
