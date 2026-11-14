import type { DrivenSession } from '@shared/contracts/generated/bindings';

/** Columns of the calendar: the backend sends 53 weeks of sessions. */
export const CALENDAR_WEEKS = 53;

const DAYS_PER_WEEK = 7;
const MS_PER_SECOND = 1000;
const MONDAY = 1;

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
  /** After today: the rest of the current week, drawn empty. */
  future: boolean;
}

const localMidnight = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const dayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/**
 * The calendar's weeks, Monday first, the week of `nowS` last, every session
 * on the local day it started.
 */
export const drivenWeeks = (
  sessions: DrivenSession[],
  nowS: number
): DrivenDay[][] => {
  const today = localMidnight(new Date(nowS * MS_PER_SECOND));
  const daysSinceMonday =
    (today.getDay() - MONDAY + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const firstDay = new Date(today);
  firstDay.setDate(
    today.getDate() - daysSinceMonday - (CALENDAR_WEEKS - 1) * DAYS_PER_WEEK
  );

  const sessionsByDay = new Map<string, DrivenSession[]>();

  for (const session of sessions) {
    const key = dayKey(new Date(session.startedAt * MS_PER_SECOND));
    const daySessions = sessionsByDay.get(key) ?? [];
    daySessions.push(session);
    sessionsByDay.set(key, daySessions);
  }

  const weeks: DrivenDay[][] = [];

  for (let weekIndex = 0; weekIndex < CALENDAR_WEEKS; weekIndex++) {
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
      });
    }

    weeks.push(week);
  }

  return weeks;
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
