import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runInAction } from 'mobx';

import { RendererCore } from '@app/roots/renderer-core';
import {
  mockCoachFrame,
  mockReferenceLap,
  PREVIEW_BRAKE_RELEASE_PCT,
  PREVIEW_BRAKE_START_PCT,
  referenceSpeedKmhAt,
} from '@features/preview/mocks/coach';
import { REFERENCE_LAP_BUCKET_COUNT } from '@shared/contracts/generated/backend-constants';
import type {
  CarDynamicsFrame,
  LapTimingFrame,
} from '@shared/contracts/generated/bindings';
import { CoachWidgetStore } from './coach.store';
import { playerLapDistPct } from './coach-trace-utils';

const COACH = 'coach';
const KMH_PER_MPS = 3.6;

/** The lap the trace is recorded against, read back bucket by bucket. */
type RecordedTrace = { ownSpeedByBucket: Float32Array };

const bucketPct = (bucket: number): number =>
  bucket / REFERENCE_LAP_BUCKET_COUNT;

describe('CoachWidgetStore — the recorded trace', () => {
  let core: RendererCore;
  let coach: CoachWidgetStore;

  const drive = (bucket: number, speed: number) => {
    runInAction(() => {
      core.backendComputed.updateCoach({
        ...mockCoachFrame(),
        lapDistPct: bucketPct(bucket),
      });
      core.player.updateCarDynamics({ speed } as CarDynamicsFrame);
    });
  };

  const speedAt = (bucket: number): number =>
    (coach as unknown as RecordedTrace).ownSpeedByBucket[bucket];

  beforeEach(() => {
    core = new RendererCore({ skipInit: true, startsWidgetStores: true });
    coach = new CoachWidgetStore({ core, instanceId: COACH });
  });

  afterEach(() => {
    coach.dispose();
    core.dispose();
  });

  // A flat fill drew a step every time the position moved on: the buckets
  // between two samples now run along the line from one to the other.
  it('fills the buckets between two samples along the line between them', () => {
    drive(100, 10);
    drive(104, 30);

    expect([101, 102, 103].map(speedAt)).toEqual([15, 20, 25]);
    expect(speedAt(104)).toBe(30);
  });

  it('places the sample where the coach frame says the car is', () => {
    runInAction(() => {
      core.player.updateLapTiming({
        lap_dist_pct: bucketPct(500),
      } as LapTimingFrame);
    });

    drive(200, 40);

    expect(speedAt(200)).toBe(40);
    expect(speedAt(500)).not.toBe(40);
  });
});

describe('playerLapDistPct', () => {
  const lapTiming = { lap_dist_pct: 0.4 } as LapTimingFrame;

  it('prefers the coach frame, which arrives on the overlay clock', () => {
    expect(
      playerLapDistPct({ ...mockCoachFrame(), lapDistPct: 0.6 }, lapTiming)
    ).toBe(0.6);
  });

  it('falls back to lap timing when the coach frame carries none', () => {
    expect(playerLapDistPct(mockCoachFrame(), lapTiming)).toBe(0.4);
    expect(playerLapDistPct(null, lapTiming)).toBe(0.4);
  });

  it('reports no position for the sim marker or an empty frame', () => {
    expect(
      playerLapDistPct(null, { lap_dist_pct: -1 } as LapTimingFrame)
    ).toBeNull();
    expect(playerLapDistPct(null, null)).toBeNull();
  });
});

describe('CoachWidgetStore — the phase times', () => {
  const TRACK_LENGTH_M = 4000;
  /** Off the brakes, short of the apex: the braking zone is behind the car. */
  const CAR_PCT = 0.495;

  let core: RendererCore;
  let coach: CoachWidgetStore;

  /** This lap up to the car: the reference's speed, scaled by `pace` in the braking zone. */
  const driveTo = (pace: number, carPct = CAR_PCT) => {
    runInAction(() => {
      core.player.lapTiming = { lap_dist_pct: carPct } as never;
    });

    const lastBucket = Math.floor(carPct * REFERENCE_LAP_BUCKET_COUNT);

    for (let bucket = 0; bucket <= lastBucket; bucket++) {
      const pct = bucketPct(bucket);
      const braking =
        pct >= PREVIEW_BRAKE_START_PCT && pct <= PREVIEW_BRAKE_RELEASE_PCT;

      coach.seedBucket(
        bucket,
        (referenceSpeedKmhAt(pct) / KMH_PER_MPS) * (braking ? pace : 1),
        braking ? 1 : 0,
        braking ? 0 : 1
      );
    }

    coach.refreshFromSeed();
  };

  const createStores = (startsWidgetStores: boolean) => {
    core = new RendererCore({ skipInit: true, startsWidgetStores });
    coach = new CoachWidgetStore({ core, instanceId: COACH });

    runInAction(() => {
      core.session.sessionInfo = { trackLengthM: TRACK_LENGTH_M } as never;
      core.player.lapTiming = { lap_dist_pct: CAR_PCT } as never;
      core.referenceLap.updateReferenceLap(mockReferenceLap());
    });
  };

  /** A store that records on the telemetry frame and follows the reference, as in an overlay. */
  const startReactions = () => {
    coach.dispose();
    core.dispose();
    createStores(true);
  };

  beforeEach(() => {
    createStores(false);
  });

  afterEach(() => {
    coach.dispose();
    core.dispose();
  });

  it('settles the braking zone once the car is past it', () => {
    driveTo(0.95);

    const time = coach.displayedBrakeTime;

    expect(time?.kind).toBe('settled');
    expect(time?.deltaS).toBeGreaterThan(0);
  });

  // The phase is measured again on every frame; a time read afresh each time
  // could wander and the header would flicker with it.
  it('keeps a settled time for the rest of the corner', () => {
    driveTo(0.95);

    const settled = coach.displayedBrakeTime;

    // The same corner measured again, differently.
    driveTo(0.9);

    expect(coach.displayedBrakeTime).toEqual(settled);
  });

  // The braking point leaves the window 150 m behind the car, long before the
  // corner is over; the figure went with it.
  it('keeps the last corner up down the straight after it', () => {
    driveTo(0.95);

    const settled = coach.displayedBrakeTime;

    // 300 m on, out of the corner: the braking point is far behind the window.
    driveTo(0.95, CAR_PCT + 0.075);

    expect(coach.displayedBrakeTime).toEqual(settled);
  });

  // A reference change mid-lap rebuilt the window but kept the figures
  // settled against the old one.
  it('measures the corner afresh against a new reference', () => {
    startReactions();
    driveTo(0.95);

    const settled = coach.displayedBrakeTime;

    runInAction(() => {
      core.referenceLap.updateReferenceLap(
        mockReferenceLap({
          samples: mockReferenceLap().samples.map((sample) => ({
            ...sample,
            speed: sample.speed * 1.1,
          })),
        })
      );
    });

    expect(coach.displayedBrakeTime?.deltaS).not.toBe(settled?.deltaS);
  });

  // Crossing the line clears this lap's trace; the figures went with it,
  // just when the driver looks at them down the straight.
  it('keeps the last corner up across the line', () => {
    startReactions();
    driveTo(0.95);

    const settled = coach.displayedBrakeTime;

    expect(settled?.kind).toBe('settled');

    const driveFrame = (pct: number, speed: number) => {
      runInAction(() => {
        core.player.lapTiming = { lap_dist_pct: pct } as never;
        core.player.updateCarDynamics({ speed } as CarDynamicsFrame);
      });
    };

    driveFrame(0.99, 50);
    driveFrame(0.002, 51);

    expect(coach.displayedBrakeTime).toEqual(settled);
  });
});
