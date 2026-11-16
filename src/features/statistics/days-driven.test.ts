import { describe, expect, it } from 'vitest';

import type { DrivenSession } from '@shared/contracts/generated/bindings';
import {
  drivenTotals,
  drivenWeeks,
  drivenYears,
  intensityLevel,
  monthStarts,
} from './days-driven';

const MS_PER_SECOND = 1000;
const DAYS_PER_WEEK = 7;
const DAY_S = 24 * 60 * 60;

/** Local time, so the test holds in any time zone. */
const at = (month: number, day: number, hour: number) =>
  new Date(2026, month, day, hour).getTime() / MS_PER_SECOND;

const driven = (startedAt: number, timeInCarS: number): DrivenSession => ({
  key: `key:${startedAt}`,
  startedAt,
  timeInCarS,
  trackName: 'Spa',
  carName: 'BMW M4 GT3',
});

// Saturday 14 November 2026, afternoon.
const NOW_S = at(10, 14, 15);
const YEAR = 2026;
/** 1 January 2026 is a Thursday, 31 December too: 53 Monday-first weeks. */
const WEEKS_OF_2026 = 53;

describe('drivenWeeks', () => {
  it('lays the year out Monday first, from the week of 1 January to that of 31 December', () => {
    const weeks = drivenWeeks([], YEAR, NOW_S);
    const firstWeek = weeks[0];
    const lastWeek = weeks[weeks.length - 1];

    expect(weeks).toHaveLength(WEEKS_OF_2026);
    expect(weeks.every((week) => week.length === DAYS_PER_WEEK)).toBe(true);
    expect(new Date(firstWeek[0].dayStartS * MS_PER_SECOND).getDay()).toBe(1);
    // Monday 29 December 2025 to Wednesday 31: the year before.
    expect(firstWeek.map((day) => day.outside)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    // Thursday 31 December 2026 is the year's last day.
    expect(lastWeek.map((day) => day.outside)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
  });

  it('marks the days after today as still to come', () => {
    const weeks = drivenWeeks([], YEAR, NOW_S);
    const days = weeks.flat();
    const today = days.findIndex((day) => day.dayStartS === at(10, 14, 0));

    expect(days[today].future).toBe(false);
    expect(days[today + 1].future).toBe(true);
  });

  it('adds up the sessions of one local day', () => {
    const weeks = drivenWeeks(
      [
        driven(at(10, 12, 9), 1_200),
        driven(at(10, 12, 23), 600),
        driven(at(10, 13, 0), 300),
      ],
      YEAR,
      NOW_S
    );
    const days = weeks.flat();
    const thursday = days.find((day) => day.dayStartS === at(10, 12, 0));
    const friday = days.find((day) => day.dayStartS === at(10, 13, 0));

    expect(thursday?.timeInCarS).toBe(1_800);
    expect(thursday?.sessions).toHaveLength(2);
    expect(friday?.timeInCarS).toBe(300);
  });

  it('leaves out a session of another year', () => {
    const weeks = drivenWeeks([driven(NOW_S - 400 * DAY_S, 600)], YEAR, NOW_S);

    expect(weeks.flat().some((day) => day.sessions.length > 0)).toBe(false);
  });
});

describe('drivenYears', () => {
  it('runs from the first session’s year to now’s', () => {
    expect(drivenYears([driven(NOW_S - 400 * DAY_S, 600)], NOW_S)).toEqual({
      first: 2025,
      last: 2026,
    });
  });

  it('is only the current year without sessions', () => {
    expect(drivenYears([], NOW_S)).toEqual({ first: 2026, last: 2026 });
  });
});

describe('intensityLevel', () => {
  it('splits the time up to the longest day in four steps', () => {
    expect(
      [0, 1, 250, 251, 500, 750, 999, 1_000].map((seconds) =>
        intensityLevel(seconds, 1_000)
      )
    ).toEqual([0, 1, 1, 2, 2, 3, 4, 4]);
  });
});

describe('monthStarts', () => {
  it('labels the column of each month’s first Monday, not a month begun before', () => {
    const weeks = drivenWeeks([], YEAR, NOW_S);
    const labels = monthStarts(weeks).map(({ column, mondayS }) => {
      const monday = new Date(mondayS * MS_PER_SECOND);

      return [column, monday.getMonth(), monday.getDate()];
    });

    // The first column's Monday is 29 December 2025: January's label goes
    // over Monday 5 January.
    expect(labels[0]).toEqual([1, 0, 5]);
    expect(labels.at(-1)).toEqual([49, 11, 7]);
    expect(labels).toHaveLength(12);
  });
});

describe('drivenTotals', () => {
  it('counts the days with time in the car and adds their time', () => {
    const weeks = drivenWeeks(
      [
        driven(at(10, 12, 9), 1_200),
        driven(at(10, 12, 20), 600),
        driven(at(10, 10, 9), 300),
      ],
      YEAR,
      NOW_S
    );

    expect(drivenTotals(weeks)).toEqual({ days: 2, timeInCarS: 2_100 });
  });
});
