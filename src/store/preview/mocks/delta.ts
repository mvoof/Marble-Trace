import type {
  LapDeltaFrame,
  LapHistoryEntry,
  LapLogFrame,
  LapTimingFrame,
} from '@/types/bindings';

// Mock builders for the delta domain — the live delta, the sector split and the
// lap history the three timing widgets draw. Pure: each takes a partial
// override and returns a *complete* frame typed from the generated bindings, so
// a field added to the contract breaks this file rather than leaking silently
// into every fixture. Nothing here touches a store.

/** The lap the preview's history is built around, in seconds. */
const MOCK_BEST_LAP_S = 90.845;

const MOCK_LAP_HISTORY: LapHistoryEntry[] = [
  { lapNum: 10, lapTime: 91.204, delta: 0.359, isBest: false },
  { lapNum: 9, lapTime: 90.845, delta: null, isBest: true },
  { lapNum: 8, lapTime: 91.688, delta: 0.843, isBest: false },
  { lapNum: 7, lapTime: null, delta: null, isBest: false },
  { lapNum: 6, lapTime: 92.017, delta: 1.172, isBest: false },
  { lapNum: 5, lapTime: 91.436, delta: 0.591, isBest: false },
  { lapNum: 4, lapTime: 91.972, delta: 1.127, isBest: false },
  { lapNum: 3, lapTime: 93.104, delta: 2.259, isBest: false },
];

/**
 * A mid-lap timing picture with a set personal best behind it — the base every
 * delta scenario states its difference against.
 *
 * The delta fields are raw values the sim supplies rather than something this
 * app computes, so they are filled directly. Every `_ok` flag is raised: a
 * reference the sim has not established yet reads as no delta at all, which is
 * the one state the preview must not default to.
 */
export const mockLapTiming = (
  overrides: Partial<LapTimingFrame> = {}
): LapTimingFrame => ({
  lap: 11,
  lap_dist: 2398.79,
  lap_dist_pct: 0.6713578,
  lap_current_lap_time: 61.284,
  lap_last_lap_time: 91.204,
  lap_best_lap_time: MOCK_BEST_LAP_S,
  player_car_position: 17,
  player_car_class_position: 7,
  lap_delta_to_session_best_live: 0.412,
  lap_delta_to_session_optimal_live: 0.688,
  lap_delta_to_driver_best_live: 0.236,
  lap_delta_to_best_lap: 0.236,
  lap_delta_to_best_lap_dd: false,
  lap_delta_to_best_lap_ok: true,
  lap_delta_to_optimal_lap: 0.481,
  lap_delta_to_optimal_lap_dd: false,
  lap_delta_to_optimal_lap_ok: true,
  lap_delta_to_session_best_lap: 0.412,
  lap_delta_to_session_best_lap_dd: false,
  lap_delta_to_session_best_lap_ok: true,
  lap_delta_to_session_lastl_lap: 0.127,
  lap_delta_to_session_lastl_lap_dd: false,
  lap_delta_to_session_lastl_lap_ok: true,
  lap_delta_to_session_optimal_lap: 0.688,
  lap_delta_to_session_optimal_lap_dd: false,
  lap_delta_to_session_optimal_lap_ok: true,
  ...overrides,
});

/**
 * The same delta against every reference at once. A driver switching the
 * widget's reference is comparing the treatments, not the numbers, so a
 * scenario states one delta and all five readouts carry it.
 */
export const mockLapTimingAtDelta = (
  delta: number,
  overrides: Partial<LapTimingFrame> = {}
): LapTimingFrame =>
  mockLapTiming({
    lap_delta_to_best_lap: delta,
    lap_delta_to_optimal_lap: delta,
    lap_delta_to_session_best_lap: delta,
    lap_delta_to_session_lastl_lap: delta,
    lap_delta_to_session_optimal_lap: delta,
    lap_delta_to_driver_best_live: delta,
    lap_delta_to_session_best_live: delta,
    lap_delta_to_session_optimal_live: delta,
    ...overrides,
  });

/**
 * A lap split three ways with the first two behind the driver.
 *
 * The defaults are the worst realistic case the matrix has to lay out: a
 * sector past a minute, so the time column carries its longest string, and a
 * signed delta on either side of the reference.
 */
export const mockLapDelta = (
  overrides: Partial<LapDeltaFrame> = {}
): LapDeltaFrame => ({
  sectorTimes: [28.412, 31.276, 26.904],
  currentSectorIdx: 1,
  sectorDeltas: [-0.124, 0.087, -0.052],
  ...overrides,
});

/**
 * The eight laps the log draws plus the lap that has just been completed.
 * The history runs newest first, the way the backend caps and emits it.
 */
export const mockLapLog = (
  overrides: Partial<LapLogFrame> = {}
): LapLogFrame => ({
  history: MOCK_LAP_HISTORY,
  lastCompletedLap: { lapNum: 10, delta: 0.359 },
  ...overrides,
});

/**
 * The history as it stands the moment `lapNum` has been completed as a
 * personal best — the entry is marked best and every older lap re-deltaed
 * against it, so the log's star row and the widget's flash agree.
 */
export const mockPersonalBestLapLog = (
  lapNum: number,
  lapTime: number
): LapLogFrame => {
  const older = MOCK_LAP_HISTORY.filter((entry) => entry.lapNum < lapNum).map(
    (entry) => ({
      ...entry,
      delta: entry.lapTime === null ? null : entry.lapTime - lapTime,
      isBest: false,
    })
  );

  return {
    history: [{ lapNum, lapTime, delta: null, isBest: true }, ...older],
    lastCompletedLap: { lapNum, delta: null },
  };
};
