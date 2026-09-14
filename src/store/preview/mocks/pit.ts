import type { PitTargetFrame } from '@/types/bindings';

// Mock builders for the pit domain. Pure: each takes a partial override and
// returns a *complete* frame typed from the generated bindings, so a field
// added to the contract breaks this file rather than leaking silently into
// every fixture. Nothing here touches a store.

/**
 * A car rolling down the pit lane towards its stall.
 *
 * This frame is what the lane bar and the box countdown are drawn from — the
 * backend only produces it while the car is actually in the pits, so every pit
 * scenario has to state one or both widgets draw an empty lane.
 */
export const mockPitTarget = (
  overrides: Partial<PitTargetFrame> = {}
): PitTargetFrame => ({
  distM: 126,
  target: 'pitbox',
  laneProgressPct: 0.15,
  ...overrides,
});
