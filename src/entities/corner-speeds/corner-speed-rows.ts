import type { CornerSpeedsFrame } from '@shared/contracts/generated/bindings';

export type CornerSpeedPoint = 'entry' | 'apex' | 'exit';

export interface CornerSpeedRow {
  point: CornerSpeedPoint;
  /** The speed at this point, m/s — the reference lap's, or with none the car's own. */
  value: number | null;
  /** Whether the car has got to the point yet — what lights the figure up. */
  reached: boolean;
}

/**
 * What a corner speed readout shows, top to bottom: entry, apex, exit. Shared
 * by every widget that draws the corner speeds, so they light up alike.
 */
export const cornerSpeedRows = (
  frame: CornerSpeedsFrame | null
): CornerSpeedRow[] => [
  {
    point: 'entry',
    value: frame?.entry ?? null,
    reached: frame?.entryPassed ?? false,
  },
  {
    point: 'apex',
    value: frame?.apex ?? null,
    reached: frame?.apexPassed ?? false,
  },
  {
    point: 'exit',
    value: frame?.exit ?? null,
    reached: frame?.exitPassed ?? false,
  },
];
