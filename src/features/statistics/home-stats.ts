import type { WeekStats } from '@shared/contracts/generated/bindings';

export type Direction = 'up' | 'down' | 'flat';

const PERCENT = 100;

export const directionOf = (change: number | null): Direction => {
  if (change === null || change === 0) {
    return 'flat';
  }

  return change > 0 ? 'up' : 'down';
};

/** Full laps without an incident, a whole percent; `null` with no full lap. */
export const cleanLapsPercent = (week: WeekStats): number | null =>
  week.fullLaps === 0
    ? null
    : Math.round((week.cleanLaps / week.fullLaps) * PERCENT);

/** `current` against `previous`; `null` when either is unknown. */
export const changeBetween = (
  current: number | null,
  previous: number | null
): number | null =>
  current === null || previous === null ? null : current - previous;

/** Races finished in the top three, a whole percent; `null` with no race. */
export const podiumPercent = (week: WeekStats): number | null =>
  week.races === 0 ? null : Math.round((week.podiums / week.races) * PERCENT);
