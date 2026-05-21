export const LAP_TIME_COLORS = {
  best: 'rgba(192, 132, 252, 0.85)',
  current: '#22c55e',
  last: '#ef4444',
  p1: 'rgba(238, 238, 238, 0.85)',
  predicted: '#fbbf24',
} as const;

export const formatDelta = (delta: number | null): string => {
  if (delta === null) {
    return '+-.---';
  }

  if (Math.abs(delta) < 0.001) {
    return '+-.---';
  }

  return (delta >= 0 ? '+' : '') + delta.toFixed(3);
};

export const getDeltaColor = (delta: number | null): string | undefined => {
  if (delta === null) {
    return undefined;
  }

  if (delta < -0.001) {
    return '#22c55e';
  }

  if (delta > 0.001) {
    return '#ef4444';
  }

  return '#fbbf24';
};
