/**
 * A speed gap this far (display units) off zero is a real difference, and the
 * chip takes the gain or loss color.
 */
export const SPEED_GAP_SHOW_UNITS = 3;

/**
 * Once shown, the gap stays shown until it is back this close to zero. A gap
 * that wobbles across zero by a unit is rounding, not driving: without the
 * band between the two the chip would flip green, grey and red on every frame.
 */
export const SPEED_GAP_HIDE_UNITS = 1;

/** The gap as the chip shows it: a difference, even, or nothing to compare. */
export type ShownSpeedGap =
  | { kind: 'gap'; units: number }
  | { kind: 'even' }
  | { kind: 'none' };

export const NO_SPEED_GAP: ShownSpeedGap = { kind: 'none' };

/**
 * What the chip shows for `gap`, given what it showed last: a difference turns
 * on past `SPEED_GAP_SHOW_UNITS` and off again only at `SPEED_GAP_HIDE_UNITS`.
 */
export const settleSpeedGap = (
  previous: ShownSpeedGap,
  gap: number | null
): ShownSpeedGap => {
  if (gap === null) {
    return NO_SPEED_GAP;
  }

  const threshold =
    previous.kind === 'gap' ? SPEED_GAP_HIDE_UNITS : SPEED_GAP_SHOW_UNITS - 1;

  if (Math.abs(gap) <= threshold) {
    return { kind: 'even' };
  }

  return { kind: 'gap', units: gap };
};
