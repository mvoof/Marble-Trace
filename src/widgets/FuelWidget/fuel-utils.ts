const HISTORY_WINDOW = 10;

export interface FuelHistoryStats {
  last: number | null;
  avg10: number | null;
  min: number | null;
  max: number | null;
}

export const computeFuelHistoryStats = (
  history: number[]
): FuelHistoryStats => {
  if (history.length === 0) {
    return { last: null, avg10: null, min: null, max: null };
  }

  const last = history[history.length - 1];
  const window10 = history.slice(-HISTORY_WINDOW);
  const avg10 = window10.reduce((sum, v) => sum + v, 0) / window10.length;
  const min = Math.min(...history);
  const max = Math.max(...history);

  return { last, avg10, min, max };
};
