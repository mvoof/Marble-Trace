import { formatLapTime } from '@shared/lib/telemetry-format';

/** What the matrix writes where it has no time: a dash, never a template. */
export const EMPTY_VALUE = '-';

/** A lap time, or a dash when there is none yet. */
export const formatLapTimeOrDash = (seconds: number | null): string => {
  if (seconds === null || seconds <= 0) {
    return EMPTY_VALUE;
  }

  return formatLapTime(seconds);
};
