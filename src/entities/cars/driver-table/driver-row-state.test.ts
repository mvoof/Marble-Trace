import { describe, expect, it } from 'vitest';

import type { CarIdentity } from '@shared/contracts/car-identity';
import {
  TRACK_SURFACE_IN_PIT_STALL,
  TRACK_SURFACE_OFF_TRACK,
  TRACK_SURFACE_ON_TRACK,
} from '@shared/lib/driver';

import { driverRowStateOf, type DriverRowContext } from './driver-row-state';

const makeDriver = (overrides: Partial<CarIdentity> = {}): CarIdentity =>
  ({
    carIdx: 4,
    isPlayer: false,
    isFinished: false,
    isRetired: false,
    isTowed: false,
    onPitRoad: false,
    rawFlags: 0,
    trackSurface: TRACK_SURFACE_ON_TRACK,
    ...overrides,
  }) as CarIdentity;

const RACING: DriverRowContext = {
  isSessionEnded: false,
  isPlayerTowing: false,
};

describe('driverRowStateOf', () => {
  it('reads a car on track as nothing to flag', () => {
    expect(driverRowStateOf(makeDriver(), RACING)).toMatchObject({
      isOut: false,
      isPit: false,
      isTowed: false,
      isOffTrack: false,
      flagType: 'none',
    });
  });

  it('reads a car in the garage as out while the session runs', () => {
    const inGarage = makeDriver({ trackSurface: 'NotInWorld' });

    expect(driverRowStateOf(inGarage, RACING).isOut).toBe(true);
    expect(
      driverRowStateOf(inGarage, { ...RACING, isSessionEnded: true }).isOut
    ).toBe(false);
  });

  it('lets a finish outrank retirement and the tow', () => {
    const state = driverRowStateOf(
      makeDriver({ isFinished: true, isRetired: true, isTowed: true }),
      RACING
    );

    expect(state.isOut).toBe(false);
    expect(state.isTowed).toBe(false);
  });

  it('reads a car in the stall or on pit road as in the pits', () => {
    expect(
      driverRowStateOf(
        makeDriver({ trackSurface: TRACK_SURFACE_IN_PIT_STALL }),
        RACING
      ).isPit
    ).toBe(true);
    expect(
      driverRowStateOf(makeDriver({ onPitRoad: true }), RACING).isPit
    ).toBe(true);
  });

  it('reads the towing player as towed', () => {
    const player = makeDriver({ isPlayer: true });

    expect(
      driverRowStateOf(player, { ...RACING, isPlayerTowing: true }).isTowed
    ).toBe(true);
    expect(
      driverRowStateOf(makeDriver(), { ...RACING, isPlayerTowing: true })
        .isTowed
    ).toBe(false);
  });

  it('does not flag an out car as off track', () => {
    expect(
      driverRowStateOf(
        makeDriver({ isRetired: true, trackSurface: TRACK_SURFACE_OFF_TRACK }),
        RACING
      ).isOffTrack
    ).toBe(false);
    expect(
      driverRowStateOf(
        makeDriver({ trackSurface: TRACK_SURFACE_OFF_TRACK }),
        RACING
      ).isOffTrack
    ).toBe(true);
  });
});
