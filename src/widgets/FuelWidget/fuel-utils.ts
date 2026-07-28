import type { FuelWidgetSettings } from '@/types/widget-settings';

const HISTORY_WINDOW = 10;

export interface FuelHistoryStats {
  last: number | null;
  avg10: number | null;
  min: number | null;
  max: number | null;
}

export const computeFuelHistoryStats = (
  history: number[]
): FuelHistoryStats => {
  if (history.length === 0) {
    return { last: null, avg10: null, min: null, max: null };
  }

  const last = history[history.length - 1];
  const window10 = history.slice(-HISTORY_WINDOW);
  const avg10 = window10.reduce((sum, v) => sum + v, 0) / window10.length;
  const min = Math.min(...history);
  const max = Math.max(...history);

  return { last, avg10, min, max };
};

export type FuelStatKey = keyof FuelHistoryStats;

const FUEL_STAT_ORDER: FuelStatKey[] = ['last', 'avg10', 'min', 'max'];

export const FUEL_STAT_LABELS: Record<FuelStatKey, string> = {
  last: 'LAST',
  avg10: 'AVG 10',
  min: 'MIN',
  max: 'MAX',
};

const FUEL_STAT_SETTING_KEYS: Record<FuelStatKey, keyof FuelWidgetSettings> = {
  last: 'showStatLast',
  avg10: 'showStatAvg10',
  min: 'showStatMin',
  max: 'showStatMax',
};

export const getVisibleFuelStatKeys = (
  settings: FuelWidgetSettings
): FuelStatKey[] =>
  FUEL_STAT_ORDER.filter((key) => settings[FUEL_STAT_SETTING_KEYS[key]]);

const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 3600;

export interface NextStopForecastInput {
  lapsRemaining: number | null;
  pitWindowStart: number | null;
  pitWarningLaps: number;
  lapTimeSec: number | null;
}

export interface NextStopForecast {
  targetLap: number | null;
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
  const { lapsRemaining, pitWindowStart, pitWarningLaps, lapTimeSec } = input;

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
