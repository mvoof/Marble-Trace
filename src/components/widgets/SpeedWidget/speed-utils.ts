export const CIRCLE_R = 130;
export const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

const KPH_TO_MS = 1 / 3.6;
const MPH_TO_MS = 0.44704;

export const parsePitSpeedLimitMs = (raw: string | null): number => {
  if (!raw) return 0;
  const match = raw.match(/^([\d.]+)\s*(kph|mph)/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  return unit === 'mph' ? value * MPH_TO_MS : value * KPH_TO_MS;
};

export const getShiftZoneColor = (
  pct: number,
  colors: { low: string; mid: string; high: string; limit: string }
): string => {
  if (pct >= 1) return colors.limit;
  if (pct >= 0.7) return colors.high;
  if (pct >= 0.35) return colors.mid;
  return colors.low;
};
