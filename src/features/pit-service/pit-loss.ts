/**
 * Where the player is in a pit stop, as far as the time it costs goes:
 *
 * - `track` — not on pit road; the whole stop is still to come,
 * - `entering` — on pit road, not yet in the stall,
 * - `stall` — standing in the stall (or towed into it),
 * - `leaving` — out of the stall on the way to the exit line.
 */
export type PitVisitPhase = 'track' | 'entering' | 'stall' | 'leaving';

interface PitLossInput {
  phase: PitVisitPhase;
  /** Entry line to exit line, measured from the field; null until timed. */
  laneLossS: number | null;
  /** Stall to exit line; null until timed. */
  exitLossS: number | null;
  /** Seconds still to stand in the stall. */
  standstillS: number;
}

/**
 * Seconds the stop still costs against the field from where the car is now:
 * the lane still to drive, over and above racing pace, plus the standing still.
 * Null when nothing is known, or once the car has left the stall — what is left
 * of the lane is a few seconds, and the cars that get past then are on screen.
 *
 * On pit road before the stall the whole lane is still counted, so the answer
 * runs high by the stretch already driven — on the safe side, and over within
 * seconds, once the car stops.
 */
export const pitTimeStillToLoseS = ({
  phase,
  laneLossS,
  exitLossS,
  standstillS,
}: PitLossInput): number | null => {
  if (phase === 'leaving') {
    return null;
  }

  const laneS = phase === 'stall' ? exitLossS : laneLossS;
  const totalS = (laneS ?? 0) + standstillS;

  return totalS > 0 ? totalS : null;
};
