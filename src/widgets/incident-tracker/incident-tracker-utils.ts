const SR_DECIMALS = 2;

/** Shown where a number is not known; a single glyph keeps the cell's width. */
export const UNKNOWN_VALUE = '—';

/** `3.47`, or a dash until the rating is known. */
export const formatSr = (sr: number | null): string =>
  sr === null ? UNKNOWN_VALUE : sr.toFixed(SR_DECIMALS);

/**
 * `+0.12` / `-0.08` — the sign always written, so the readout keeps its length
 * as the change crosses zero. A change that rounds to nothing is `+0.00`.
 */
export const formatSrDelta = (delta: number): string => {
  const rounded = Number(delta.toFixed(SR_DECIMALS));
  const sign = rounded < 0 ? '-' : '+';

  return `${sign}${Math.abs(rounded).toFixed(SR_DECIMALS)}`;
};

export type DeltaDirection = 'up' | 'down' | 'flat';

/** Which way the change points once rounded as it is drawn; none is flat. */
export const deltaDirection = (delta: number | null): DeltaDirection => {
  if (delta === null) {
    return 'flat';
  }

  const rounded = Number(delta.toFixed(SR_DECIMALS));

  if (rounded > 0) {
    return 'up';
  }

  if (rounded < 0) {
    return 'down';
  }

  return 'flat';
};

/** Whole corners still to drive clean, rounded up: a part-corner is still owed. */
export const roundCornersUp = (corners: number): number => Math.ceil(corners);
