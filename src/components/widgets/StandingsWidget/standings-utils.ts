import type { DriverEntry } from './types';

export const TRACK_SURFACE_OFF_TRACK = 0;
export const TRACK_SURFACE_IN_PIT_STALL = 1;
export const NEAR_DQ_INCIDENT_THRESHOLD = 15;

export const shortenClassName = (name: string): string => {
  if (name.length <= 6) return name;
  return name.split(' ')[0] ?? name;
};

export const formatIRating = (ir: number): string => {
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return ir.toString();
};

export const computeClassSof = (drivers: DriverEntry[]): number => {
  if (drivers.length === 0) return 0;
  const total = drivers.reduce((sum, d) => sum + d.iRating, 0);
  return Math.round(total / drivers.length);
};

export const formatBrand = (screenName: string): string => {
  if (!screenName) return '';
  return screenName.split(' ')[0] ?? screenName;
};
