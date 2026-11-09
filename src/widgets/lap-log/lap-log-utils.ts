import type { LapHistoryEntry } from '@shared/contracts/generated/bindings';
import type { StatChipTone } from '@shared/ui/StatChip/StatChip';
import { formatLapTime } from '@shared/lib/telemetry-format';

/** The StatChip tones a lap's delta takes. */
export type PaceLossTone = Extract<
  StatChipTone,
  'positive' | 'accent' | 'danger'
>;

/** Up to this many seconds off the best, a lap is close — yellow, not red. */
const CLOSE_LOSS_SECONDS = 0.5;

/** A lap this far off the best fills its pace-loss bar. */
const FULL_BAR_LOSS_SECONDS = 1.8;

/** The chip and bar color of a lap's delta to the best. */
export const paceLossTone = (delta: number): PaceLossTone => {
  if (delta < 0) {
    return 'positive';
  }

  if (delta <= CLOSE_LOSS_SECONDS) {
    return 'accent';
  }

  return 'danger';
};

/** How much of its column a lap's pace-loss bar fills, 0 to 1. */
export const paceLossFraction = (delta: number): number => {
  if (delta <= 0) {
    return 0;
  }

  return Math.min(1, delta / FULL_BAR_LOSS_SECONDS);
};

export interface ValidLapAverage {
  /** Seconds, or null when no lap has a time. */
  average: number | null;
  count: number;
}

/** The mean of the laps that have a time; an invalidated lap has none. */
export const averageValidLapTime = (
  entries: readonly LapHistoryEntry[]
): ValidLapAverage => {
  const times = entries
    .map((entry) => entry.lapTime)
    .filter((time): time is number => time !== null && time > 0);

  if (times.length === 0) {
    return { average: null, count: 0 };
  }

  const total = times.reduce((sum, time) => sum + time, 0);

  return { average: total / times.length, count: times.length };
};

/** What the log writes where it has no time or delta: a dash, never a template. */
export const EMPTY_VALUE = '-';

/** A lap time, or a dash when there is none yet. */
export const formatLapTimeOrDash = (seconds: number | null): string => {
  if (seconds === null || seconds <= 0) {
    return EMPTY_VALUE;
  }

  return formatLapTime(seconds);
};
