import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runInAction } from 'mobx';

import { RendererCore } from '@app/roots/renderer-core';
import {
  mockCoachFrame,
  mockReferenceLap,
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

describe('CoachWidgetStore — the phase figures', () => {
  const TRACK_LENGTH_M = 4000;
  /** Past the preview corner's braking point, before its apex. */
  const CAR_PCT = 0.485;

  let core: RendererCore;
  let coach: CoachWidgetStore;

  /** This lap up to the car: the reference's speed, on the brakes from `brakeFromPct`. */
  const driveTo = (brakeFromPct: number) => {
    const lastBucket = Math.floor(CAR_PCT * REFERENCE_LAP_BUCKET_COUNT);

    for (let bucket = 0; bucket <= lastBucket; bucket++) {
      const pct = bucketPct(bucket);
      const braking = pct >= brakeFromPct;

      coach.seedBucket(
        bucket,
        referenceSpeedKmhAt(pct) / KMH_PER_MPS,
        braking ? 1 : 0,
        braking ? 0 : 1
      );
    }

    coach.refreshFromSeed();
  };

  beforeEach(() => {
    core = new RendererCore({ skipInit: true });
    coach = new CoachWidgetStore({ core, instanceId: COACH });

    runInAction(() => {
      core.session.sessionInfo = { trackLengthM: TRACK_LENGTH_M } as never;
      core.player.lapTiming = { lap_dist_pct: CAR_PCT } as never;
      core.referenceLap.updateReferenceLap(mockReferenceLap());
    });
  });

  afterEach(() => {
    coach.dispose();
    core.dispose();
  });

  // Both points are measured again on every frame; a miss read afresh each
  // time wandered by a metre or two and the header flickered with it.
  it('keeps a miss as it was first measured for the rest of the corner', () => {
    const lateByPct = 0.002;

    driveTo(PREVIEW_BRAKE_START_PCT + lateByPct);

    const settled = coach.displayedBrakeFigure;

    expect(settled?.kind).toBe('miss');
    expect(
      Math.abs((settled?.valueM ?? 0) - lateByPct * TRACK_LENGTH_M)
    ).toBeLessThan(3);

    // The same corner measured again, a few metres differently.
    driveTo(PREVIEW_BRAKE_START_PCT + lateByPct + 0.001);

    expect(coach.displayedBrakeFigure).toEqual(settled);
  });
});
