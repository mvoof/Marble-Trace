import type { FuelWidgetSettings } from '@/types/widget-settings';
import {
  FUEL_AVG_WINDOW_ALL_LAPS,
  FUEL_THRESHOLDS,
} from '@utils/constants/fuel-constants';

export interface FuelHistoryStats {
  last: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
}

/**
 * Every stat shares the averaging window the user configured, so MIN/MAX cannot
 * drag in the out-lap or a caution lap that the average itself already ignores.
 * `window === 0` means the whole recorded history, matching `FuelState::avg`.
 */
export const computeFuelHistoryStats = (
  history: number[],
  window: number
): FuelHistoryStats => {
  if (history.length === 0) {
    return { last: null, avg: null, min: null, max: null };
  }

  const laps =
    window === FUEL_AVG_WINDOW_ALL_LAPS ? history : history.slice(-window);

  const last = history[history.length - 1];
  const avg = laps.reduce((sum, value) => sum + value, 0) / laps.length;
  const min = Math.min(...laps);
  const max = Math.max(...laps);

  return { last, avg, min, max };
};

export type FuelStatKey = keyof FuelHistoryStats;

const FUEL_STAT_ORDER: FuelStatKey[] = ['last', 'avg', 'min', 'max'];

const FUEL_STAT_STATIC_LABELS: Record<Exclude<FuelStatKey, 'avg'>, string> = {
  last: 'LAST',
  min: 'MIN',
  max: 'MAX',
};

/** The average column names its own window so the setting is visible in-place. */
export const getFuelStatLabel = (key: FuelStatKey, window: number): string => {
  if (key !== 'avg') {
    return FUEL_STAT_STATIC_LABELS[key];
  }

  if (window === FUEL_AVG_WINDOW_ALL_LAPS) {
    return 'AVG ALL';
  }

  return `AVG ${window}`;
};

const FUEL_STAT_SETTING_KEYS: Record<FuelStatKey, keyof FuelWidgetSettings> = {
  last: 'showStatLast',
  avg: 'showStatAvg10',
  min: 'showStatMin',
  max: 'showStatMax',
};

export const getVisibleFuelStatKeys = (
  settings: FuelWidgetSettings
): FuelStatKey[] =>
  FUEL_STAT_ORDER.filter((key) => settings[FUEL_STAT_SETTING_KEYS[key]]);

/** Laps the current tank covers at a given per-lap consumption. */
export const computeLapsToEmpty = (
  fuelLevel: number | null,
  consumptionPerLap: number | null
): number | null => {
  if (
    fuelLevel === null ||
    consumptionPerLap === null ||
    fuelLevel <= 0 ||
    consumptionPerLap <= 0
  ) {
    return null;
  }

  return fuelLevel / consumptionPerLap;
};

export type FuelLapsStatus = 'safe' | 'warning' | 'danger';

/**
 * Shared by the summary and the pit forecast so both speak about urgency with
 * the same thresholds instead of drifting apart.
 */
export const resolveLapsStatus = (
  lapsRemaining: number | null,
  pitWarningLaps: number
): FuelLapsStatus | null => {
  if (lapsRemaining === null) {
    return null;
  }

  if (lapsRemaining <= pitWarningLaps) {
    return 'danger';
  }

  if (lapsRemaining > pitWarningLaps + FUEL_THRESHOLDS.LAPS_LEFT_GREEN_BUFFER) {
    return 'safe';
  }

  return 'warning';
};

export interface RefuelPlan {
  /** Stops needed to take on the whole amount, 1 when a single tank covers it. */
  stops: number;
  /** What to dial in at this stop — a full tank while more stops remain. */
  fillNow: number;
}

/**
 * Splitting the total evenly across stops would recommend an amount no real
 * stop uses. Drivers fill to the brim early and take the remainder last, so
 * `fillNow` is capped by tank capacity instead.
 */
export const computeRefuelPlan = (
  fuelToAdd: number | null,
  fuelMax: number | null
): RefuelPlan | null => {
  if (fuelToAdd === null || fuelToAdd <= 0) {
    return null;
  }

  if (fuelMax === null || fuelMax <= 0) {
    return { stops: 1, fillNow: fuelToAdd };
  }

  return {
    stops: Math.ceil(fuelToAdd / fuelMax),
    fillNow: Math.min(fuelToAdd, fuelMax),
  };
};

const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 3600;

export interface NextStopForecastInput {
  lapsRemaining: number | null;
  pitWindowStart: number | null;
  pitWindowEnd: number | null;
  pitWarningLaps: number;
  lapTimeSec: number | null;
}

export interface NextStopForecast {
  targetLap: number | null;
  /** Last lap of the window; the stop is a range, not a single lap. */
  windowEndLap: number | null;
  lapsUntil: number;
  secondsUntil: number | null;
}

/**
 * Forecast of the upcoming pit stop, shown before the pit window opens.
 * `lapsUntil` counts down to the moment the window starts, not to a dry tank.
 */
export const computeNextStopForecast = (
  input: NextStopForecastInput
): NextStopForecast | null => {
  const {
    lapsRemaining,
    pitWindowStart,
    pitWindowEnd,
    pitWarningLaps,
    lapTimeSec,
  } = input;

  if (lapsRemaining === null || !Number.isFinite(lapsRemaining)) {
    return null;
  }

  const lapsUntil = lapsRemaining - pitWarningLaps;

  if (lapsUntil <= 0) {
    return null;
  }

  const secondsUntil =
    lapTimeSec !== null && lapTimeSec > 0 ? lapsUntil * lapTimeSec : null;

  return {
    targetLap: pitWindowStart,
    windowEndLap: pitWindowEnd,
    lapsUntil,
    secondsUntil,
  };
};

export const formatCountdown = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / SECONDS_IN_HOUR);
  const minutes = Math.floor((total % SECONDS_IN_HOUR) / SECONDS_IN_MINUTE);
  const secs = total % SECONDS_IN_MINUTE;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
};
