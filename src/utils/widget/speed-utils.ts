const KPH_TO_MS = 1 / 3.6;
const MPH_TO_MS = 0.44704;

export const parsePitSpeedLimitMs = (
  raw: string | null | undefined
): number => {
  if (!raw) return 0;

  const match = raw.match(/^([\d.]+)\s*(kph|mph)/i);

  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  return unit === 'mph' ? value * MPH_TO_MS : value * KPH_TO_MS;
};
