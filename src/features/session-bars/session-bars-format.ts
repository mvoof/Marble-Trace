export const parseWeekendTemp = (
  tempStr: string | null | undefined
): number | null => {
  if (tempStr == null) {
    return null;
  }

  const num = parseFloat(tempStr);

  return isNaN(num) ? null : num;
};

const UNLIMITED_LAPS = 'unlimited';

// Replaces the count on the last lap — the fact matters more than the number.
const FINAL_LAP_LABEL = 'FINAL';

export interface LapProgress {
  value: string;
  isFinalLap: boolean;
  /** Longest the value can grow to, so the pill reserves its width up front. */
  widthChars: number;
}

/**
 * The leader's lap against the session length. On the last lap the count is
 * replaced by the fact that matters more than the number.
 */
export const buildLapProgress = (
  leaderLap: number | null,
  totalLaps: string | null,
  isEstimated: boolean
): LapProgress | null => {
  if (leaderLap === null) {
    return null;
  }

  if (totalLaps === null || totalLaps.toLowerCase() === UNLIMITED_LAPS) {
    return {
      value: String(leaderLap),
      isFinalLap: false,
      widthChars: String(leaderLap).length,
    };
  }

  const totalCount = Number(totalLaps);
  const isFinalLap =
    !isEstimated && Number.isFinite(totalCount) && leaderLap >= totalCount;

  // Width is reserved for the widest lap the session can reach, not for the
  // one on screen — otherwise the header shifts on the way from 9 to 10.
  const widthChars = Math.max(
    FINAL_LAP_LABEL.length,
    totalLaps.length * 2 + (isEstimated ? 2 : 1)
  );

  if (isFinalLap) {
    return { value: FINAL_LAP_LABEL, isFinalLap: true, widthChars };
  }

  const value = `${leaderLap}/${isEstimated ? `~${totalLaps}` : totalLaps}`;

  return { value, isFinalLap: false, widthChars };
};
