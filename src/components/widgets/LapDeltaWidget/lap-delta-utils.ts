export const DELTA_CAP = 3.0;

export type DeltaState = 'ahead' | 'behind' | 'neutral';
export type LapDeltaLayout = 'vertical' | 'horizontal';

export const SECTOR_ACCENT_COLORS = [
  '#eab308',
  '#3b82f6',
  '#a855f7',
  '#10b981',
  '#ef4444',
  '#f97316',
];

const DELTA_STATE_COLOR: Record<DeltaState, string> = {
  ahead: '#22c55e',
  behind: '#ef4444',
  neutral: '#fbbf24',
};

export const formatDelta = (delta: number | null): string => {
  if (delta === null) return '—';
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

export const getDeltaColor = (state: DeltaState): string =>
  DELTA_STATE_COLOR[state];

export const formatSectorTime = (v: number | null): string => {
  if (v === null) return '--';
  const m = Math.floor(v / 60);
  const s = v % 60;
  return m > 0
    ? `${m}:${s.toFixed(3).padStart(6, '0')}`
    : s.toFixed(3).padStart(6, '0');
};

export const formatSectorDelta = (v: number | null): string => {
  if (v === null) return '--';
  return (v >= 0 ? '+' : '') + v.toFixed(2);
};

export const getSectorDeltaState = (v: number | null): DeltaState => {
  if (v === null) return 'neutral';
  if (v < -0.001) return 'ahead';
  if (v > 0.001) return 'behind';
  return 'neutral';
};
