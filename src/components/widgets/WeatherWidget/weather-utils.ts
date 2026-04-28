import type {
  WeatherForecastEntry,
  WeekendInfo,
} from '../../../types/bindings';
import type { UnitSystem } from '../../../types/units';
import {
  formatSpeed as _formatSpeed,
  speedUnit as _speedUnit,
} from '../../../utils/telemetry-format';

export type SkiesIconType = 'sun' | 'cloud-sun' | 'cloud' | 'cloud-rain';

export const parseWeekendFloat = (
  value: string | null | undefined
): number | null => {
  if (value == null) return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
};

export const radsToBearing = (radians: number): number => {
  const deg = radians * (180 / Math.PI);
  return ((deg % 360) + 360) % 360;
};

export const bearingToCardinal = (deg: number): string => {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
};

export const getSkiesIconType = (skies: string | null): SkiesIconType => {
  if (!skies) return 'sun';
  const s = skies.toLowerCase();
  if (s.includes('rain') || s.includes('fog') || s.includes('thunder'))
    return 'cloud-rain';
  if (s.includes('overcast') || s.includes('cloudy')) return 'cloud';
  if (s.includes('partly')) return 'cloud-sun';
  return 'sun';
};

export const parseFogLevel = (fog: string | null | undefined): string => {
  const n = parseWeekendFloat(fog);
  return n !== null ? `${Math.round(n)}%` : '—';
};

export const parsePrecipitation = (
  precip: string | null | undefined
): string => {
  const n = parseWeekendFloat(precip);
  return n !== null ? `${Math.round(n)}%` : '—';
};

export const formatWindSpeed = (
  mps: number | null,
  system: UnitSystem
): string => {
  if (mps === null) return '\u2014';
  return `${_formatSpeed(mps, system)} ${_speedUnit(system)}`;
};

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
export const extractForecast = (
  weekendInfo: WeekendInfo
): WeatherForecastEntry[] => {
  if (!weekendInfo) return [];

  // unknown_fields might be present if the Rust backend includes it
  const fields = (weekendInfo as any).unknown_fields || weekendInfo;

  // Try standard WeatherForecastList -> WeatherForecast
  const list = fields.WeatherForecastList || fields.weatherforecastlist;
  if (list) {
    const entries = list.WeatherForecast || list.weatherforecast || list;
    if (Array.isArray(entries)) return entries as WeatherForecastEntry[];
  }

  // Try direct WeatherForecast
  const direct = fields.WeatherForecast || fields.weatherforecast;
  if (direct) {
    if (Array.isArray(direct)) return direct as WeatherForecastEntry[];

    const entries =
      direct.ForecastEntries ||
      direct.forecastentries ||
      direct.WeatherForecast ||
      direct.weatherforecast;
    if (Array.isArray(entries)) return entries as WeatherForecastEntry[];
  }

  // Try direct ForecastEntries
  const fe =
    (weekendInfo as any).ForecastEntries ||
    (weekendInfo as any).forecastentries;
  if (Array.isArray(fe)) return fe as WeatherForecastEntry[];

  console.log(
    '[WeatherWidget] No forecast found in WeekendInfo. Available keys:',
    Object.keys(weekendInfo)
  );

  return [];
};
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
