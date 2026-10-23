import type { CornerSpeedsFrame } from '@shared/contracts/generated/bindings';
import { MPS_TO_KMH } from '@shared/lib/telemetry-format';
import { cornerSpeedRows } from './corner-speed-rows';

/** How close to the lit target counts as on it, km/h. */
const ON_TARGET_KMH = 5;
const ON_TARGET_MPS = ON_TARGET_KMH / MPS_TO_KMH;

/** The car's speed against the lit reference target. */
export type TargetSpeedState = 'onTarget' | 'over';

/**
 * Whether the car is on the target it is heading for, or still over it; `null`
 * below it, or with no reference target to measure against.
 */
export const targetSpeedState = (
  speed: number,
  frame: CornerSpeedsFrame | null
): TargetSpeedState | null => {
  if (!frame?.fromReference) {
    return null;
  }

  const target = cornerSpeedRows(frame).find((row) => row.lit)?.value ?? null;

  if (target === null) {
    return null;
  }

  const difference = speed - target;

  if (Math.abs(difference) <= ON_TARGET_MPS) {
    return 'onTarget';
  }

  return difference > 0 ? 'over' : null;
};

export interface TargetSpeedColors {
  onTarget: string;
  over: string;
}

/**
 * The colour the speed is written in against the lit target: one of `colors`,
 * or `''` to leave the speed its own colour.
 *
 * Call it only with the target colour switched on: reading the frame
 * subscribes the caller to it, and without a reference it changes on every
 * bundle under braking.
 */
export const targetSpeedColor = (
  speed: number,
  frame: CornerSpeedsFrame | null,
  colors: TargetSpeedColors
): string => {
  const state = targetSpeedState(speed, frame);

  if (state === 'onTarget') {
    return colors.onTarget;
  }

  return state === 'over' ? colors.over : '';
};
