import type {
  RatingPoint,
  WeekStats,
} from '@shared/contracts/generated/bindings';

const SECONDS_PER_DAY = 24 * 60 * 60;

/** How far back the iRating chart looks. */
export const IRATING_RANGES = ['30d', '90d', 'all'] as const;

export type IratingRange = (typeof IRATING_RANGES)[number];

const RANGE_DAYS: Record<IratingRange, number | null> = {
  '30d': 30,
  '90d': 90,
  all: null,
};

export type Direction = 'up' | 'down' | 'flat';

/** One step of the iRating chart. */
export interface IratingStep extends RatingPoint {
  /** Against the session before it; `null` for the first one ever. */
  change: number | null;
}

export const directionOf = (change: number | null): Direction => {
  if (change === null || change === 0) {
    return 'flat';
  }

  return change > 0 ? 'up' : 'down';
};

/**
 * The sessions of `range` up to `nowS`, each with its change against the one
 * before — counted over the whole history, so the first step of a range
 * still shows how it moved.
 */
export const iratingSteps = (
  history: RatingPoint[],
  range: IratingRange,
  nowS: number
): IratingStep[] => {
  const days = RANGE_DAYS[range];
  const fromS = days === null ? -Infinity : nowS - days * SECONDS_PER_DAY;

  return history
    .map((point, index) => ({
      ...point,
      change: index === 0 ? null : point.irating - history[index - 1].irating,
    }))
    .filter((step) => step.startedAt >= fromS);
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
