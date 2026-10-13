import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runInAction } from 'mobx';

import { RendererCore } from '@app/roots/renderer-core';
import { mockCoachFrame } from '@features/preview/mocks/coach';
import { REFERENCE_LAP_BUCKET_COUNT } from '@shared/contracts/backend-constants';
import type {
  CarDynamicsFrame,
  LapTimingFrame,
} from '@shared/contracts/bindings';
import { CoachWidgetStore } from './coach.store';
import { playerLapDistPct } from './coach-trace-utils';

const COACH = 'coach';

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
