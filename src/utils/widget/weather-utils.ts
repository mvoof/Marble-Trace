export const getWindColor = (mps: number | null): string => {
  if (mps === null) {
    return '#3b82f6';
  }

  if (mps > 8) {
    return '#ef4444';
  }

  if (mps > 4) {
    return '#eab308';
  }

  return '#3b82f6';
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
      return { label: 'UNKNOWN', color: '#9ca3af', isWet: false };
    case 1:
      return { label: 'DRY', color: '#f59e0b', isWet: false };
    case 2:
      return { label: 'MOSTLY DRY', color: '#10b981', isWet: false };
    case 3:
      return { label: 'V. LIGHT WET', color: '#60a5fa', isWet: true };
    case 4:
      return { label: 'LIGHTLY WET', color: '#3b82f6', isWet: true };
    case 5:
      return { label: 'MOD. WET', color: '#2563eb', isWet: true };
    case 6:
      return { label: 'VERY WET', color: '#f97316', isWet: true };
    case 7:
    default:
      return { label: 'EXT. WET', color: '#ef4444', isWet: true };
  }
};

export const HUMIDITY_COLOR = '#3b82f6';

const TRACK_TEMP_MIN_C = 10;
const TRACK_TEMP_MAX_C = 60;
const HUMIDITY_MAX_PERCENT = 100;
const WIND_MAX_MPS = 15;
const WETNESS_MAX_LEVEL = 7;

const clampFraction = (value: number): number =>
  Math.min(1, Math.max(0, value));

const toFraction = (
  value: number | null | undefined,
  min: number,
  max: number
): number => {
  if (value == null) {
    return 0;
  }

  return clampFraction((value - min) / (max - min));
};

export const trackTempFraction = (celsius: number | null): number =>
  toFraction(celsius, TRACK_TEMP_MIN_C, TRACK_TEMP_MAX_C);

export const airTempFraction = (celsius: number | null): number =>
  toFraction(celsius, TRACK_TEMP_MIN_C, TRACK_TEMP_MAX_C);

export const humidityFraction = (percent: number | null): number =>
  toFraction(percent, 0, HUMIDITY_MAX_PERCENT);

export const windFraction = (mps: number | null): number =>
  toFraction(mps, 0, WIND_MAX_MPS);

export const wetnessFraction = (level: number | null | undefined): number =>
  toFraction(level, 0, WETNESS_MAX_LEVEL);

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

const SKIES_LABELS: Record<string, string> = {
  Clear: 'Clear',
  '0': 'Clear',
  PartlyCloudy: 'Partly Cloudy',
  '1': 'Partly Cloudy',
  MostlyCloudy: 'Mostly Cloudy',
  '2': 'Mostly Cloudy',
  Overcast: 'Overcast',
  '3': 'Overcast',
};

export const getSkiesLabel = (
  skies: string | number | null | undefined
): string =>
  skies != null ? (SKIES_LABELS[String(skies)] ?? String(skies)) : 'Clear';
