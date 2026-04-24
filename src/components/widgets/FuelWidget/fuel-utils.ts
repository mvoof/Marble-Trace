export interface FuelCalculations {
  avgPerLap: number | null;
  lapsRemaining: number | null;
  lapsToFinish: number | null;
  shortage: number | null;
  fuelToAdd: number | null;
  fuelToAddWithBuffer: number | null;
  fuelSavePerLap: number | null;
  pitWarning: boolean;
  pitWindowStart: number | null;
  pitWindowEnd: number | null;
}

export const formatFuelLiters = (v: number | null): string => {
  if (v === null) return '—';
  return v.toFixed(2) + ' L';
};

export const formatLaps = (v: number | null): string => {
  if (v === null) return '—';
  return v.toFixed(1);
};

export const formatShortage = (v: number | null): string => {
  if (v === null) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}`;
};
