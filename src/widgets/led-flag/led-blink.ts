import type { FlagType } from '@shared/contracts/domain';
import type { BlinkCycle } from '@shared/hooks/useBlink';
import { FLAG_BLINK } from '@entities/flags/flag-blink';

/** Flags whose animated pattern blinks — the rest render statically. */
const BLINKING_FLAGS: ReadonlySet<FlagType> = new Set([
  'yellow',
  'blue',
  'checkered',
  'debris',
  'meatball',
  'black',
  'furled',
  'sc',
  'dq',
  'red',
  'white',
]);

/** Every two-state pattern: lit and dark half a second each. */
const MATRIX_BLINK: BlinkCycle = { stepMs: 500, steps: 2 };

/** White breathes slower: a second lit, a second half dark. */
const WHITE_BREATH: BlinkCycle = { stepMs: 1000, steps: 2 };

const MS_PER_SECOND = 1000;

/** Steps the green fill holds every ring lit, then dark, after the sweep in. */
const GREEN_FILL_TAIL_STEPS = 4;

/**
 * The green fill sweeps in ring by ring, holds and goes dark once a second, so
 * its step count follows the board's ring count. Matches the `@for` over
 * `data-max-ring` in LedMatrix.module.scss.
 */
const greenFillCycle = (maxRing: number): BlinkCycle => {
  const steps = maxRing + GREEN_FILL_TAIL_STEPS;

  return { stepMs: MS_PER_SECOND / steps, steps };
};

/**
 * The cycle `LedMatrix` writes on its board for the flag on show: the animated
 * pattern, or — with the animation off — the plain flash every flag widget
 * gives a yellow or a red.
 */
export const boardBlinkCycle = (
  flag: FlagType,
  animate: boolean,
  maxRing: number
): BlinkCycle | null => {
  if (!animate) {
    return flag === 'yellow' || flag === 'red' ? FLAG_BLINK : null;
  }

  if (flag === 'green') {
    return greenFillCycle(maxRing);
  }

  if (flag === 'white') {
    return WHITE_BREATH;
  }

  return BLINKING_FLAGS.has(flag) ? MATRIX_BLINK : null;
};
