export const CIRCLE_R = 105;
export const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

export const getShiftZoneColor = (
  pct: number,
  colors: { low: string; mid: string; high: string; limit: string }
): string => {
  if (pct >= 1) return colors.limit;
  if (pct >= 0.7) return colors.high;
  if (pct >= 0.35) return colors.mid;
  return colors.low;
};
