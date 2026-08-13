import type { LapHistoryEntry, LapTimingFrame } from '@/types/bindings';
import type { LapDeltaReference } from '@/types/widget-settings';

export type DeltaState = 'ahead' | 'behind' | 'neutral';
export type LapDeltaLayout = 'vertical' | 'horizontal';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

// Every delta renders into the same number of monospace slots, so the widget
// can reserve the space once and never rescale the glyphs: a growing number
// changes its format, not its size.
export const DELTA_SLOTS = 7;

const TEN_MINUTES = 10 * SECONDS_PER_MINUTE;

const padSlots = (text: string): string => text.padStart(DELTA_SLOTS, ' ');

export const formatDelta = (delta: number | null): string => {
  if (delta === null) return padSlots('-.---');

  const sign = delta >= 0 ? '+' : '-';
  const abs = Math.abs(delta);

  // Each branch rounds to its own precision *before* splitting minutes from
  // seconds — rounding after the split would let 119.97 print as "+1:60.0".
  // " +0.284" … "+59.999" — the range a driver actually reads. Padding goes
  // in front of the sign, so the sign stays glued to its digits and the
  // decimal point still lands in the same column every frame.
  const rounded3 = Math.round(abs * 1000) / 1000;

  if (rounded3 < SECONDS_PER_MINUTE) {
    return padSlots(`${sign}${rounded3.toFixed(3)}`);
  }

  // "+1:02.4" — a tenth is plenty once a whole minute is on the board.
  const rounded1 = Math.round(abs * 10) / 10;

  if (rounded1 < TEN_MINUTES) {
    const m = Math.floor(rounded1 / SECONDS_PER_MINUTE);
    const s = rounded1 % SECONDS_PER_MINUTE;

    return padSlots(`${sign}${m}:${s.toFixed(1).padStart(4, '0')}`);
  }

  // "+59:59" — lapped-by-minutes territory, seconds are noise.
  const roundedSeconds = Math.round(abs);

  if (roundedSeconds < SECONDS_PER_HOUR) {
    const m = Math.floor(roundedSeconds / SECONDS_PER_MINUTE);
    const s = roundedSeconds % SECONDS_PER_MINUTE;

    return padSlots(`${sign}${m}:${String(s).padStart(2, '0')}`);
  }

  return padSlots(`${sign}>1h`);
};

// Gap to the driver's own best lap *before* this one, so a new personal best
// reports how much it beat the old mark by instead of a meaningless 0.000.
export const getDeltaToPreviousBest = (
  history: LapHistoryEntry[],
  lapNum: number,
  lapTime: number
): number | null => {
  const previousTimes = history
    .filter((entry) => entry.lapNum < lapNum && entry.lapTime !== null)
    .map((entry) => entry.lapTime as number);

  if (previousTimes.length === 0) return null;

  return lapTime - Math.min(...previousTimes);
};

// The gauge auto-ranges like the sim's own delta bar: a tight scale while the
// lap is close, a wider one once the gap grows, so the fill never just pins at
// the end of the track and stops carrying information.
export const DELTA_GAUGE_RANGES = [0.5, 1, 2, 5, 10] as const;

// A step is only given up once the delta drops well inside the smaller range —
// without that margin a delta sitting on a boundary would flip the scale every
// frame.
const RANGE_SHRINK_MARGIN = 0.8;

export const resolveGaugeRange = (
  delta: number | null,
  currentRange: number
): number => {
  const abs = Math.abs(delta ?? 0);
  const currentIndex = DELTA_GAUGE_RANGES.indexOf(
    currentRange as (typeof DELTA_GAUGE_RANGES)[number]
  );
  const index = currentIndex === -1 ? 0 : currentIndex;

  if (abs > DELTA_GAUGE_RANGES[index]) {
    const grown = DELTA_GAUGE_RANGES.find((range) => abs <= range);

    return grown ?? DELTA_GAUGE_RANGES[DELTA_GAUGE_RANGES.length - 1];
  }

  if (index > 0 && abs <= DELTA_GAUGE_RANGES[index - 1] * RANGE_SHRINK_MARGIN) {
    return DELTA_GAUGE_RANGES[index - 1];
  }

  return DELTA_GAUGE_RANGES[index];
};

export const getDeltaState = (delta: number | null): DeltaState => {
  if (delta === null) return 'neutral';
  if (delta < -0.001) return 'ahead';
  if (delta > 0.001) return 'behind';

  return 'neutral';
};

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

// Returns null when _OK is false (no reference lap exists yet) or the field is null.
export const getGameDelta = (
  lapTiming: LapTimingFrame | null | undefined,
  reference: LapDeltaReference
): number | null => {
  if (!lapTiming) return null;

  switch (reference) {
    // Driver's own best lap this session.
    case 'personal_best':
      return lapTiming.lap_delta_to_best_lap_ok &&
        lapTiming.lap_delta_to_best_lap != null
        ? lapTiming.lap_delta_to_best_lap
        : null;

    // Driver's theoretical best — fastest sector from each of their own laps combined.
    case 'personal_optimal':
      return lapTiming.lap_delta_to_optimal_lap_ok &&
        lapTiming.lap_delta_to_optimal_lap != null
        ? lapTiming.lap_delta_to_optimal_lap
        : null;

    // Fastest lap set by anyone in the current session.
    case 'session_best':
      return lapTiming.lap_delta_to_session_best_lap_ok &&
        lapTiming.lap_delta_to_session_best_lap != null
        ? lapTiming.lap_delta_to_session_best_lap
        : null;

    // Theoretical best — fastest sector from any driver in the session combined.
    case 'session_optimal':
      return lapTiming.lap_delta_to_session_optimal_lap_ok &&
        lapTiming.lap_delta_to_session_optimal_lap != null
        ? lapTiming.lap_delta_to_session_optimal_lap
        : null;

    // Last fully completed lap by anyone in the session. Field name has a typo in the iRacing SDK ("Lastl" not "Last").
    case 'session_last':
      return lapTiming.lap_delta_to_session_lastl_lap_ok &&
        lapTiming.lap_delta_to_session_lastl_lap != null
        ? lapTiming.lap_delta_to_session_lastl_lap
        : null;
  }

  return null;
};

export const isGameDeltaOk = (
  lapTiming: LapTimingFrame | null | undefined,
  reference: LapDeltaReference
): boolean => {
  if (!lapTiming) return false;

  switch (reference) {
    case 'personal_best':
      return !!lapTiming.lap_delta_to_best_lap_ok;
    case 'personal_optimal':
      return !!lapTiming.lap_delta_to_optimal_lap_ok;
    case 'session_best':
      return !!lapTiming.lap_delta_to_session_best_lap_ok;
    case 'session_optimal':
      return !!lapTiming.lap_delta_to_session_optimal_lap_ok;
    case 'session_last':
      return !!lapTiming.lap_delta_to_session_lastl_lap_ok;
  }
};

// The SDK's per-frame `_ok` flag drops transiently in legitimate cases that
// aren't "no reference lap exists" — e.g. right after setting a new best lap,
// until the game re-establishes the comparison for the next lap. This latch
// tracks whether a reference has EVER been valid, and holds the last known
// delta so the display doesn't blank out during those transient windows.
export interface DeltaLatchState {
  hasHadReference: boolean;
  lastValidDelta: number | null;
}

export const INITIAL_DELTA_LATCH_STATE: DeltaLatchState = {
  hasHadReference: false,
  lastValidDelta: null,
};

export const advanceDeltaLatch = (
  state: DeltaLatchState,
  deltaOk: boolean,
  liveDelta: number | null
): DeltaLatchState => {
  if (!deltaOk) return state;

  return { hasHadReference: true, lastValidDelta: liveDelta };
};

export const getDisplayedDelta = (
  state: DeltaLatchState,
  deltaOk: boolean,
  liveDelta: number | null
): number | null => (deltaOk ? liveDelta : state.lastValidDelta);
