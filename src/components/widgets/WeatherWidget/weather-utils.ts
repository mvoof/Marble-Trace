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

export const formatWindSpeed = (
  mps: number | null,
  system: UnitSystem
): string => {
  if (mps === null) return '\u2014';
  return `${_formatSpeed(mps, system)} ${_speedUnit(system)}`;
};
