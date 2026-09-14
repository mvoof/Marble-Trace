import type {
  CarStatusFrame,
  PitServiceFrame,
  PitTargetFrame,
} from '@/types/bindings';
import { mockCarStatus } from './engine';

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

/** The pit limiter's bit in the engine warning mask, as the widgets read it. */
export const PIT_LIMITER_BIT = 0x10;

/** Idle revs and neutral, which is what the box and the tow both sit at. */
const PIT_STALL_RPM = 1200;

/**
 * A stop the driver has already ordered: two tires and a fill, nothing being
 * repaired and nobody being recovered.
 *
 * This is the frame every pit scenario starts from — and the baseline's own, so
 * the widget draws an ordered corner beside a kept one without a live session.
 */
export const mockPitService = (
  overrides: Partial<PitServiceFrame> = {}
): PitServiceFrame => ({
  flags: null,
  changeLf: true,
  changeRf: true,
  changeLr: false,
  changeRr: false,
  addFuel: true,
  cleanWindshield: false,
  fastRepair: false,
  fuelAmount: 34.2,
  lfPressure: 159,
  rfPressure: 163,
  lrPressure: 155,
  rrPressure: 159,
  tireCompound: null,
  repairLeftS: 0,
  optRepairLeftS: 0,
  towTimeS: 0,
  fastRepairsAvailable: 1,
  fastRepairsUsed: 1,
  serviceStatus: null,
  inPitStall: false,
  serviceActive: false,
  ...overrides,
});

/**
 * The player's own status frame with the car on pit road.
 *
 * Built on the engine domain's status rather than patched onto the recorded
 * one for the same reason that one exists: the snapshot was captured in the
 * garage with every pressure and in-car adjustment still at zero, and a pit
 * scenario that left those alone would put a live lane bar next to a dead car.
 */
export const mockPitCarStatus = ({
  limiterOn,
}: {
  limiterOn: boolean;
}): CarStatusFrame =>
  mockCarStatus({
    on_pit_road: true,
    engine_warnings: limiterOn ? PIT_LIMITER_BIT : 0,
  });

/** The car standing still in its stall — or on the hook, which looks the same. */
export const mockPitStallDynamics = () => ({
  speed: 0,
  rpm: PIT_STALL_RPM,
  gear: 0,
});
