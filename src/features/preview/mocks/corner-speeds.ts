import type { CornerSpeedsFrame } from '@shared/contracts/generated/bindings';

// Mock builder for the corner speeds — one reference corner and how far
// through it the car is. Pure, typed from the generated bindings; nothing here
// touches a store.

const KMH_PER_MPS = 3.6;

const mps = (kmh: number): number => kmh / KMH_PER_MPS;

/** How far through the corner the car is, in the order the points light up. */
export type CornerProgress = 'approach' | 'braking' | 'pastApex' | 'exited';

const PROGRESS_ORDER: CornerProgress[] = [
  'approach',
  'braking',
  'pastApex',
  'exited',
];

export const mockCornerSpeeds = (
  progress: CornerProgress = 'exited'
): CornerSpeedsFrame => {
  const step = PROGRESS_ORDER.indexOf(progress);

  return {
    entry: mps(209),
    apex: mps(96),
    exit: mps(141),
    entryPassed: step >= 1,
    apexPassed: step >= 2,
    exitPassed: step >= 3,
    fromReference: true,
    // Braking a touch later than the reference: carrying more speed in.
    pace: 'faster',
  };
};
