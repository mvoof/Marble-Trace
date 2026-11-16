import type { WeekStats } from '@shared/contracts/generated/bindings';

export type Direction = 'up' | 'down' | 'flat';

export const directionOf = (change: number | null): Direction => {
  if (change === null || change === 0) {
    return 'flat';
  }

  return change > 0 ? 'up' : 'down';
};

/** `null` when no lap was driven. */
export const incidentsPerLap = (week: WeekStats): number | null =>
  week.laps === 0 ? null : week.incidents / week.laps;

const PER_LAP_SCALE = 100;

/**
 * Incidents per lap against the seven days before, to two places; `null`
 * when either span drove no lap.
 */
export const incidentsPerLapChange = (
  week: WeekStats,
  previousWeek: WeekStats
): number | null => {
  const perLap = incidentsPerLap(week);
  const previousPerLap = incidentsPerLap(previousWeek);

  if (perLap === null || previousPerLap === null) {
    return null;
  }

  return Math.round((perLap - previousPerLap) * PER_LAP_SCALE) / PER_LAP_SCALE;
};
