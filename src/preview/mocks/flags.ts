import type { RaceFlags } from '@/types/bindings';

// Mock builders for the flag domain. Pure: each takes a partial override and
// returns a *complete* frame typed from the generated bindings, so a field
// added to the contract breaks this file rather than leaking silently into
// every fixture. Nothing here touches a store.

/**
 * Every flag bit down — the state a race spends most of its time in, and the
 * base each flag scenario states its single difference against.
 *
 * A flag scenario forces the one flag it is named after and nothing else: the
 * sim raises bits in combinations (yellow with caution, meatball with repair)
 * and a fixture that carried leftovers from the previous scenario would show a
 * widget a flag nobody asked for.
 */
export const mockFlags = (overrides: Partial<RaceFlags> = {}): RaceFlags => ({
  checkered: false,
  white: false,
  green: false,
  yellow: false,
  red: false,
  blue: false,
  debris: false,
  yellowWaving: false,
  caution: false,
  cautionWaving: false,
  black: false,
  disqualify: false,
  meatball: false,
  furled: false,
  repair: false,
  ...overrides,
});
