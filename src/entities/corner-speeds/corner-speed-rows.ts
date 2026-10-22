import type { CornerSpeedsFrame } from '@shared/contracts/generated/bindings';

export type CornerSpeedPoint = 'entry' | 'apex' | 'exit';

export interface CornerSpeedRow {
  point: CornerSpeedPoint;
  /**
   * The large figure, m/s: the car's own once it has reached the point, the
   * reference lap's before that — the target. With no reference, the lowest
   * speed so far stands in at an apex not yet passed.
   */
  value: number | null;
  reached: boolean;
  /** The reference beside a reached figure, m/s. */
  reference: number | null;
}

/**
 * What a corner speed readout shows, top to bottom: entry, apex, exit. Shared
 * by every widget that draws the corner speeds, so they light up alike.
 */
export const cornerSpeedRows = (
  frame: CornerSpeedsFrame | null
): CornerSpeedRow[] => {
  const pass = frame?.current ?? null;
  const target = frame?.target ?? null;

  const row = (
    point: CornerSpeedPoint,
    reached: boolean,
    own: number | null,
    reference: number | null
  ): CornerSpeedRow => {
    if (reached) {
      return { point, value: own, reached, reference };
    }

    return { point, value: reference ?? own, reached, reference: null };
  };

  return [
    row('entry', pass !== null, pass?.entry ?? null, target?.entry ?? null),
    row(
      'apex',
      pass?.apexPassed ?? false,
      pass?.apex ?? null,
      target?.apex ?? null
    ),
    row(
      'exit',
      (pass?.exit ?? null) !== null,
      pass?.exit ?? null,
      target?.exit ?? null
    ),
  ];
};
