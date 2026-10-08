/**
 * Everything the pit lane speed gauge draws, kept out of the components so the
 * thresholds are testable and the row stays a rendering of them.
 */

/**
 * Share of the speed row the green track covers: everything up to the limit.
 * The short red remainder is the overspeed tip, so the seam between them is the
 * limit itself and a small overspeed is still visible instead of pinning.
 */
export const SPEED_GREEN_SHARE = 0.82;

/** How far past the limit the red tip reaches, as a share of the limit. */
export const OVER_RANGE_PCT = 0.2;

/** Reaction time granted to the driver before the lift has to happen. */
const LIFT_LEAD_S = 0.3;

export interface SpeedRowView {
  /** Fill inside the green track, 0..SPEED_GREEN_SHARE. */
  fill: number;
  /** Fill inside the red tip, 0..(1 - SPEED_GREEN_SHARE). */
  overFill: number;
  isOver: boolean;
  /**
   * Band the car coasts into if the throttle is held for `LIFT_LEAD_S` more.
   * `null` while the car is not gaining speed — there is nothing to lift for.
   */
  liftStart: number | null;
  liftWidth: number | null;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Everything the speed row draws, from the two numbers the sim gives and the
 * longitudinal acceleration. The speed itself is rendered as it comes — the
 * scale is a ratio, so it needs no display unit. Kept out of the component so the thresholds are
 * testable and the row stays a rendering of them.
 */
export const buildSpeedRow = (
  speedMs: number,
  limitMs: number,
  longAccelMs2: number | null
): SpeedRowView => {
  if (limitMs <= 0) {
    return {
      fill: 0,
      overFill: 0,
      isOver: false,
      liftStart: null,
      liftWidth: null,
    };
  }

  const isOver = speedMs > limitMs;

  const fill = clamp01(speedMs / limitMs) * SPEED_GREEN_SHARE;
  const overShare = clamp01((speedMs - limitMs) / (limitMs * OVER_RANGE_PCT));
  const overFill = isOver ? overShare * (1 - SPEED_GREEN_SHARE) : 0;

  // Where the car ends up if nothing changes. Below the limit that band is the
  // last moment to lift; at or past it the red fill already says the same.
  const projected = speedMs + Math.max(0, longAccelMs2 ?? 0) * LIFT_LEAD_S;
  const hasLift = !isOver && projected > speedMs;
  const liftEnd = hasLift
    ? clamp01(projected / limitMs) * SPEED_GREEN_SHARE
    : null;

  return {
    fill,
    overFill,
    isOver,
    liftStart: liftEnd === null ? null : fill,
    liftWidth: liftEnd === null ? null : Math.max(0, liftEnd - fill),
  };
};
