import type { WeatherForecastEntry, WeekendInfo } from '@/types/bindings';
import type { UnitSystem } from '@/types';
import {
  formatSpeed as _formatSpeed,
  speedUnit as _speedUnit,
} from '@utils/formatters/telemetry-format';

export const getWindColor = (mps: number | null): string => {
  if (mps === null) {
    return '#3399ff';
  }

  if (mps > 8) {
    return '#ef4444';
  }

  if (mps > 4) {
    return '#ffcc00';
  }

  return '#3399ff';
};

export interface TrackWetnessInfo {
  label: string;
  color: string;
  isWet: boolean;
}

export const getTrackWetnessInfo = (
  wetness: number | null | undefined
): TrackWetnessInfo | null => {
  if (wetness == null) return null;

  switch (wetness) {
    case 0:
      return { label: 'UNKNOWN', color: '#7d8794', isWet: false };
    case 1:
      return { label: 'DRY', color: '#a57d27', isWet: false };
    case 2:
      return { label: 'MOSTLY DRY', color: '#82a860', isWet: false };
    case 3:
      return { label: 'V. LIGHT WET', color: '#5f8fc4', isWet: true };
    case 4:
      return { label: 'LIGHTLY WET', color: '#4d78b8', isWet: true };
    case 5:
      return { label: 'MOD. WET', color: '#3d60a0', isWet: true };
    case 6:
      return { label: 'VERY WET', color: '#b87030', isWet: true };
    case 7:
    default:
      return { label: 'EXT. WET', color: '#b04040', isWet: true };
  }
};

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

  return [];
};
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

export type WeatherIconType = 'sun' | 'cloud-sun' | 'cloud' | 'cloud-rain';

export const getWeatherIcon = (
  skies: string | number | null | undefined,
  wetness: number | null | undefined
): WeatherIconType => {
  if (wetness != null && wetness >= 3) {
    return 'cloud-rain';
  }

  if (skies == null || skies === '') return 'sun';

  const skiesStr = String(skies);

  if (skiesStr === 'Clear' || skiesStr === '0') return 'sun';

  if (skiesStr === 'PartlyCloudy' || skiesStr === '1') return 'cloud-sun';

  if (
    skiesStr === 'MostlyCloudy' ||
    skiesStr === '2' ||
    skiesStr === 'Overcast' ||
    skiesStr === '3'
  ) {
    return 'cloud';
  }

  return 'sun';
};
