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
