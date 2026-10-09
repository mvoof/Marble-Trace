import type { SafetyRatingFrame } from '@shared/contracts/bindings';

// Mock builder for the Safety Rating estimate. Pure: it takes a partial
// override and returns a *complete* frame typed from the generated bindings, so
// a field added to the contract breaks this file rather than leaking silently
// into every fixture. Nothing here touches a store.

/**
 * A clean race halfway through: a class C driver at 2.75 heading for a gain,
 * no incidents, nothing owed — the base every incident scenario states its
 * difference against.
 */
export const mockSafetyRating = (
  overrides: Partial<SafetyRatingFrame> = {}
): SafetyRatingFrame => ({
  driverIncidents: 0,
  teamIncidents: null,
  cornersDriven: 152,
  sessionWeight: 1,
  isRanked: null,
  srStart: 2.75,
  srNow: 2.84,
  srFinish: 2.96,
  cleanCornersNeeded: 0,
  ...overrides,
});
