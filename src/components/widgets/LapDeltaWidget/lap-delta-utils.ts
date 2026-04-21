export const DELTA_CAP = 3.0;

export type DeltaState = 'ahead' | 'behind' | 'neutral';

export const formatDelta = (delta: number | null): string => {
  if (delta === null) return '\u2014';
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(3)}`;
};

export const deltaBarPct = (delta: number | null): number => {
  if (delta === null) return 0;
  return Math.min(Math.abs(delta) / DELTA_CAP, 1.0);
};

export const getDeltaState = (delta: number | null): DeltaState => {
  if (delta === null) return 'neutral';
  if (delta < -0.001) return 'ahead';
  if (delta > 0.001) return 'behind';
  return 'neutral';
};
