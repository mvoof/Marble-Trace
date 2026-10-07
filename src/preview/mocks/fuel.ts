import type { FuelComputedFrame } from '@/types/bindings';

// Mock builders for the fuel domain. Pure: each takes a partial override and
// returns a *complete* frame typed from the generated bindings, so a field
// added to the contract breaks this file rather than leaking silently into
// every fixture. Nothing here touches a store.

const MOCK_LAP_FUEL_HISTORY: FuelComputedFrame['lapFuelHistory'] = [
  { lap: 1, used: 3.4, rejected: 'out-lap' },
  { lap: 2, used: 2.7, rejected: null },
  { lap: 3, used: 2.5, rejected: null },
  { lap: 4, used: 1.4, rejected: 'caution' },
  { lap: 5, used: 2.6, rejected: null },
  { lap: 6, used: 2.6, rejected: null },
  { lap: 7, used: 2.55, rejected: null },
  { lap: 8, used: 2.62, rejected: null },
  { lap: 9, used: 2.98, rejected: null },
  { lap: 10, used: 2.42, rejected: null },
];

/**
 * A mid-stint fuel picture with a full history behind it — the base every fuel
 * scenario states its difference against.
 *
 * The defaults are the worst realistic case the widget has to lay out: a long
 * history for the chart, four-character stats, and a signed shortage, because
 * what the preview is sized against is the widest the block ever gets.
 */
export const mockFuel = (
  overrides: Partial<FuelComputedFrame> = {}
): FuelComputedFrame => ({
  avgPerLap: 2.64,
  lapsRemaining: 9.2,
  lapsToFinish: 14,
  shortage: -5.2,
  fuelToAdd: 12.4,
  fuelToAddWithBuffer: 14.1,
  fuelSavePerLap: 0.15,
  pitWarning: false,
  pitWindowStart: 12,
  pitWindowEnd: 16,
  isTimedRace: false,
  lapFuelHistory: MOCK_LAP_FUEL_HISTORY,
  historyStats: { last: 2.7, avg: 2.64, min: 2.42, max: 2.98 },
  refuelPlan: { stops: 1, fillNow: 14.1 },
  ...overrides,
});
