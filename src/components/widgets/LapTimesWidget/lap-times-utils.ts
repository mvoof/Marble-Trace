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
