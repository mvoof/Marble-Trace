import { describe, expect, it } from 'vitest';

import type { DrivenSession } from '@shared/contracts/generated/bindings';
import { CALENDAR_WEEKS, drivenWeeks, intensityLevel } from './days-driven';

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

describe('drivenWeeks', () => {
  it('lays the weeks out Monday first, the current week last', () => {
    const weeks = drivenWeeks([], NOW_S);
    const lastWeek = weeks[weeks.length - 1];

    expect(weeks).toHaveLength(CALENDAR_WEEKS);
    expect(weeks.every((week) => week.length === DAYS_PER_WEEK)).toBe(true);
    expect(new Date(lastWeek[0].dayStartS * MS_PER_SECOND).getDay()).toBe(1);
    // Today is the Saturday: only the Sunday is still to come.
    expect(lastWeek.map((day) => day.future)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it('adds up the sessions of one local day', () => {
    const weeks = drivenWeeks(
      [
        driven(at(10, 12, 9), 1_200),
        driven(at(10, 12, 23), 600),
        driven(at(10, 13, 0), 300),
      ],
      NOW_S
    );
    const [thursday, friday] = weeks[weeks.length - 1].slice(3, 5);

    expect(thursday.timeInCarS).toBe(1_800);
    expect(thursday.sessions).toHaveLength(2);
    expect(friday.timeInCarS).toBe(300);
  });

  it('leaves out a session older than the first column', () => {
    const weeks = drivenWeeks([driven(NOW_S - 400 * DAY_S, 600)], NOW_S);

    expect(weeks.flat().some((day) => day.sessions.length > 0)).toBe(false);
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
