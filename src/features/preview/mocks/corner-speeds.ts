import type { CornerSpeedsFrame } from '@shared/contracts/generated/bindings';

// Mock builder for the corner speeds — one corner on the reference lap and the
// car's pass through it. Pure, typed from the generated bindings; nothing here
// touches a store.

const KMH_PER_MPS = 3.6;

const mps = (kmh: number): number => kmh / KMH_PER_MPS;

/** How far through the corner the car is, in the order the points light up. */
export type CornerProgress = 'approach' | 'braking' | 'pastApex' | 'exited';

export const mockCornerSpeeds = (
  progress: CornerProgress = 'exited'
): CornerSpeedsFrame => ({
  current:
    progress === 'approach'
      ? null
      : {
          entry: mps(212),
          apex: progress === 'braking' ? mps(101) : mps(94),
          apexPassed: progress !== 'braking',
          exit: progress === 'exited' ? mps(143) : null,
        },
  target: { entry: mps(209), apex: mps(96), exit: mps(141) },
});
