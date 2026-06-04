import type { LapTimingFrame } from '@/types/bindings';
import type { LapDeltaReference } from '@/types/widget-settings';

export type DeltaState = 'ahead' | 'behind' | 'neutral';
export type LapDeltaLayout = 'vertical' | 'horizontal';

//TODO: use scss vsriables instead hardcode color
const DELTA_STATE_COLOR: Record<DeltaState, string> = {
  ahead: '#22c55e',
  behind: '#ef4444',
  neutral: '#fbbf24',
};

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

export const formatDelta = (delta: number | null): string => {
  if (delta === null) return '+ -.---';

  const sign = delta >= 0 ? '+' : '-';
  const abs = Math.abs(delta);

  if (abs < SECONDS_PER_MINUTE) {
    const formattedAbs = abs.toFixed(3);
    const [intStr, fracStr] = formattedAbs.split('.');
    const paddedInt = intStr.length < 2 ? ` ${intStr}` : intStr;

    return `${sign}${paddedInt}.${fracStr}`;
  }

  if (abs < SECONDS_PER_HOUR) {
    const m = Math.floor(abs / SECONDS_PER_MINUTE);
    const s = abs % SECONDS_PER_MINUTE;

    return `${sign}${m}:${s.toFixed(3).padStart(6, '0')}`;
  }

  const h = Math.floor(abs / SECONDS_PER_HOUR);
  const rem = abs % SECONDS_PER_HOUR;
  const m = Math.floor(rem / SECONDS_PER_MINUTE);
  const s = rem % SECONDS_PER_MINUTE;

  return `${sign}${h}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
};

export const getDeltaState = (delta: number | null): DeltaState => {
  if (delta === null) return 'neutral';
  if (delta < -0.001) return 'ahead';
  if (delta > 0.001) return 'behind';

  return 'neutral';
};

export const getDeltaColor = (state: DeltaState): string =>
  DELTA_STATE_COLOR[state];

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

export const getSectorDeltaState = (v: number | null): DeltaState => {
  if (v === null) return 'neutral';
  if (v < -0.001) return 'ahead';
  if (v > 0.001) return 'behind';

  return 'neutral';
};
