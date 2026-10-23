import type { CornerSpeedsFrame } from '@shared/contracts/generated/bindings';

export type CornerSpeedPoint = 'entry' | 'apex' | 'exit';

export interface CornerSpeedRow {
  point: CornerSpeedPoint;
  /** The speed at this point, m/s — the reference lap's, or with none the car's own. */
  value: number | null;
  /** The one figure to read now; the others are dimmed. */
  lit: boolean;
}

const POINTS: CornerSpeedPoint[] = ['entry', 'apex', 'exit'];

/**
 * Which point is lit, one at a time. A reference figure is a target, so the
 * point the car is heading for is lit — the entry on the approach, the apex
 * past the entry, the exit past the apex. The car's own figures exist only
 * once measured, so the point it passed last is lit instead.
 */
const litIndexOf = (frame: CornerSpeedsFrame): number | null => {
  const passed = [frame.entryPassed, frame.apexPassed, frame.exitPassed];
  const passedCount = passed.filter(Boolean).length;

  if (frame.fromReference) {
    return Math.min(passedCount, POINTS.length - 1);
  }

  return passedCount > 0 ? passedCount - 1 : null;
};

/**
 * What a corner speed readout shows, top to bottom: entry, apex, exit. Shared
 * by every widget that draws the corner speeds, so they light up alike.
 */
export const cornerSpeedRows = (
  frame: CornerSpeedsFrame | null
): CornerSpeedRow[] => {
  const values = [frame?.entry, frame?.apex, frame?.exit];
  const litIndex = frame ? litIndexOf(frame) : null;

  return POINTS.map((point, index) => ({
    point,
    value: values[index] ?? null,
    lit: index === litIndex,
  }));
};
