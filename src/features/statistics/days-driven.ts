import type { DrivenSession } from '@shared/contracts/generated/bindings';

const DAYS_PER_WEEK = 7;
const JANUARY = 0;
const DECEMBER = 11;
const LAST_DAY_OF_DECEMBER = 31;
const MS_PER_SECOND = 1000;
const MONDAY = 1;
/** A day, rounded: a DST week is an hour off, never a day. */
const DAY_MS = 24 * 60 * 60 * MS_PER_SECOND;

/** Steps of the calendar's shading; 0 is a day not driven. */
export type IntensityLevel = 0 | 1 | 2 | 3 | 4;

const TOP_LEVEL = 4;

/** One cell of the calendar: a local day. */
export interface DrivenDay {
  /** Local midnight, unix seconds. */
  dayStartS: number;
  timeInCarS: number;
  /** Oldest first. */
  sessions: DrivenSession[];
  /** After today: the rest of the current year, drawn empty. */
  future: boolean;
  /** A day of the year before or after, filling the first or last week. */
  outside: boolean;
}

const localMidnight = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** The Monday on or before `date`, local midnight. */
const mondayOf = (date: Date) => {
  const monday = localMidnight(date);
  const daysSinceMonday =
    (monday.getDay() - MONDAY + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  monday.setDate(monday.getDate() - daysSinceMonday);

  return monday;
};

/**
 * The weeks of a calendar year, Monday first, from the week of 1 January to
 * the week of 31 December, every session on the local day it started. Days of
 * the years around it fill the first and last weeks, marked `outside`.
 */
export const drivenWeeks = (
  sessions: DrivenSession[],
  year: number,
  nowS: number
): DrivenDay[][] => {
  const today = localMidnight(new Date(nowS * MS_PER_SECOND));
  const firstDay = mondayOf(new Date(year, JANUARY, 1));
  const lastMonday = mondayOf(new Date(year, DECEMBER, LAST_DAY_OF_DECEMBER));
  const weekCount =
    Math.round(
      (lastMonday.getTime() - firstDay.getTime()) / (DAYS_PER_WEEK * DAY_MS)
    ) + 1;

  const sessionsByDay = new Map<string, DrivenSession[]>();

  for (const session of sessions) {
    const key = dayKey(new Date(session.startedAt * MS_PER_SECOND));
    const daySessions = sessionsByDay.get(key) ?? [];
    daySessions.push(session);
    sessionsByDay.set(key, daySessions);
  }

  const weeks: DrivenDay[][] = [];

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex++) {
    const week: DrivenDay[] = [];

    for (let dayIndex = 0; dayIndex < DAYS_PER_WEEK; dayIndex++) {
      // Through the date, not by adding seconds: a DST day is not 24 hours.
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + weekIndex * DAYS_PER_WEEK + dayIndex);
      const daySessions = sessionsByDay.get(dayKey(date)) ?? [];

      week.push({
        dayStartS: date.getTime() / MS_PER_SECOND,
        timeInCarS: daySessions.reduce(
          (total, session) => total + session.timeInCarS,
          0
        ),
        sessions: daySessions,
        future: date.getTime() > today.getTime(),
        outside: date.getFullYear() !== year,
      });
    }

    weeks.push(week);
  }

  return weeks;
};

/** The local year of unix seconds. */
export const yearOf = (seconds: number): number =>
  new Date(seconds * MS_PER_SECOND).getFullYear();

/** The years the calendar pages through: the first one driven to now's. */
export const drivenYears = (
  sessions: DrivenSession[],
  nowS: number
): { first: number; last: number } => {
  const last = yearOf(nowS);
  const first = sessions.length === 0 ? last : yearOf(sessions[0].startedAt);

  return { first: Math.min(first, last), last };
};

/** A month's label over the calendar: the column of its first week. */
export interface MonthStart {
  column: number;
  /** The Monday of that week, local midnight, unix seconds. */
  mondayS: number;
}

const monthOf = (dayStartS: number) => {
  const date = new Date(dayStartS * MS_PER_SECOND);

  return date.getFullYear() * 12 + date.getMonth();
};

/**
 * The columns whose Monday is the first Monday of its month. The first column
 * counts only when its Monday is: a month begun before the calendar has no
 * label of its own.
 */
export const monthStarts = (weeks: DrivenDay[][]): MonthStart[] =>
  weeks.flatMap((week, column) => {
    const mondayS = week[0].dayStartS;
    const isFirstMonday =
      new Date(mondayS * MS_PER_SECOND).getDate() <= DAYS_PER_WEEK;
    const monthChanged =
      column === 0 ||
      monthOf(weeks[column - 1][0].dayStartS) !== monthOf(mondayS);

    return isFirstMonday && monthChanged ? [{ column, mondayS }] : [];
  });

/** The days of the year with time in the car, and that time together. */
export const drivenTotals = (weeks: DrivenDay[][]) => {
  const days = weeks.flat().filter((day) => !day.outside && day.timeInCarS > 0);

  return {
    days: days.length,
    timeInCarS: days.reduce((total, day) => total + day.timeInCarS, 0),
  };
};

/** A day's shade: its time against the longest day's, in four steps. */
export const intensityLevel = (
  timeInCarS: number,
  longestDayS: number
): IntensityLevel => {
  if (timeInCarS <= 0 || longestDayS <= 0) {
    return 0;
  }

  const level = Math.ceil((timeInCarS / longestDayS) * TOP_LEVEL);

  return Math.min(Math.max(level, 1), TOP_LEVEL) as IntensityLevel;
};
