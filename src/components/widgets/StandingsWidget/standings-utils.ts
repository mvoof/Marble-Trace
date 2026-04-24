import type { DriverEntry } from '../../../types/bindings';

export const computeClassSof = (drivers: DriverEntry[]): number => {
  if (drivers.length === 0) return 0;
  const total = drivers.reduce((sum, d) => sum + d.iRating, 0);
  return Math.round(total / drivers.length);
};
