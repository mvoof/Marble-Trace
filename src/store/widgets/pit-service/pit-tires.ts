import type { ChassisFrame, PitServiceFrame } from '@/types/bindings';

export type CornerPosition = 'lf' | 'rf' | 'lr' | 'rr';

/** Every corner, in the order the black box lists them. */
export const ALL_CORNERS: CornerPosition[] = ['lf', 'rf', 'lr', 'rr'];

const WEAR_TO_PCT = 100;

/**
 * Remaining tread of the most worn of the three points across a corner, 0..1.
 * The worst point decides: a tire that is down to the cords on the outer
 * shoulder is finished no matter how healthy its middle still reads.
 */
export const cornerWorstWear = (
  position: CornerPosition,
  frame: ChassisFrame | null | undefined
): number | null => {
  const points = [
    frame?.[`${position}_wear_l`],
    frame?.[`${position}_wear_m`],
    frame?.[`${position}_wear_r`],
  ].filter((wear): wear is number => wear != null);

  if (points.length === 0) return null;

  return Math.min(...points);
};

/**
 * Corners worn down to `thresholdPct` remaining tread or below. A corner the
 * sim reports nothing for is left out — an unknown tire is not a worn one, and
 * ordering it would spend a stop on a guess.
 */
export const cornersBelowWearThreshold = (
  frame: ChassisFrame | null | undefined,
  thresholdPct: number
): CornerPosition[] =>
  ALL_CORNERS.filter((position) => {
    const wear = cornerWorstWear(position, frame);

    return wear !== null && wear * WEAR_TO_PCT <= thresholdPct;
  });

export const isCornerOrdered = (
  position: CornerPosition,
  service: PitServiceFrame | null | undefined
): boolean => {
  if (!service) return false;

  const byPosition: Record<CornerPosition, boolean> = {
    lf: service.changeLf,
    rf: service.changeRf,
    lr: service.changeLr,
    rr: service.changeRr,
  };

  return byPosition[position];
};

export const orderedPressure = (
  position: CornerPosition,
  service: PitServiceFrame | null | undefined
): number | null => {
  if (!service) return null;

  const byPosition: Record<CornerPosition, number | null> = {
    lf: service.lfPressure,
    rf: service.rfPressure,
    lr: service.lrPressure,
    rr: service.rrPressure,
  };

  return byPosition[position];
};
