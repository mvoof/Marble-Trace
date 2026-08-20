import { describe, expect, it } from 'vitest';

import {
  buildPitApproachView,
  distanceToPitEntryM,
  pitBrakeDistanceM,
  PIT_BRAKE_DECEL_MPS2,
  type PitApproachInput,
} from './pit-approach';

const baseInput: PitApproachInput = {
  distM: 200,
  distMode: 'pitbox',
  progressPct: 0.2,
  laneLengthM: 400,
  boxLanePct: 0.6,
  speedMs: 16,
  cueDistM: 100,
  withBrakeCue: true,
};

describe('buildPitApproachView', () => {
  it('stays quiet while the box is further away than the cue distance', () => {
    expect(buildPitApproachView(baseInput).urgency).toBe('far');
  });

  it('warns inside the cue distance', () => {
    expect(buildPitApproachView({ ...baseInput, distM: 80 }).urgency).toBe(
      'near'
    );
  });

  it('calls for the brakes at the braking distance for the current speed', () => {
    const brakeDistM = pitBrakeDistanceM(baseInput.speedMs);

    expect(
      buildPitApproachView({ ...baseInput, distM: brakeDistM }).urgency
    ).toBe('brake');
  });

  it('leaves the brake urgency out when the cue is switched off', () => {
    const brakeDistM = pitBrakeDistanceM(baseInput.speedMs);

    expect(
      buildPitApproachView({
        ...baseInput,
        distM: brakeDistM,
        withBrakeCue: false,
      }).urgency
    ).toBe('near');
  });

  it('reads arrived within a car length of the stall', () => {
    expect(buildPitApproachView({ ...baseInput, distM: 2 }).urgency).toBe(
      'arrived'
    );
  });

  it('stops nagging once the target is the pit exit', () => {
    const view = buildPitApproachView({
      ...baseInput,
      distM: 5,
      distMode: 'pitExit',
    });

    expect(view.urgency).toBe('far');
    expect(view.isTargetExit).toBe(true);
    expect(view.brakeMarker).toBeNull();
  });

  it('keeps the box patch inside the lane at either end', () => {
    const atStart = buildPitApproachView({ ...baseInput, boxLanePct: 0 });
    const atEnd = buildPitApproachView({ ...baseInput, boxLanePct: 1 });

    for (const view of [atStart, atEnd]) {
      expect(view.boxLeft).not.toBeNull();
      expect(view.boxWidth).not.toBeNull();
      expect(view.boxLeft!).toBeGreaterThanOrEqual(0);
      expect(view.boxWidth!).toBeGreaterThan(0);
      expect(view.boxLeft! + view.boxWidth!).toBeLessThanOrEqual(1);
    }
  });

  it('places the brake marker one braking distance before the stall', () => {
    const view = buildPitApproachView(baseInput);
    const expected =
      baseInput.boxLanePct! -
      pitBrakeDistanceM(baseInput.speedMs) / baseInput.laneLengthM!;

    expect(view.brakeMarker).toBeCloseTo(expected, 6);
  });

  it('drops the brake marker when the stop needs more lane than there is', () => {
    // 40 m/s needs 160 m to stop, further back than the stall sits.
    const view = buildPitApproachView({
      ...baseInput,
      speedMs: 40,
      boxLanePct: 0.2,
    });

    expect(view.brakeMarker).toBeNull();
  });

  it('leaves the box patch out until the pit lane has been recorded', () => {
    const view = buildPitApproachView({
      ...baseInput,
      boxLanePct: null,
      laneLengthM: null,
    });

    expect(view.boxLeft).toBeNull();
    expect(view.boxWidth).toBeNull();
  });

  it('clamps the lane fill to the bar', () => {
    expect(buildPitApproachView({ ...baseInput, progressPct: 1.4 }).fill).toBe(
      1
    );
    expect(buildPitApproachView({ ...baseInput, progressPct: null }).fill).toBe(
      0
    );
  });

  it('derives the braking distance from the deceleration it documents', () => {
    expect(pitBrakeDistanceM(10)).toBeCloseTo(
      100 / (2 * PIT_BRAKE_DECEL_MPS2),
      6
    );
  });
});

describe('distanceToPitEntryM', () => {
  const TRACK_M = 4000;

  it('measures forwards to the entry line', () => {
    expect(distanceToPitEntryM(0.8, 0.9, TRACK_M)).toBeCloseTo(400, 3);
  });

  it('counts the entry across start/finish rather than backwards', () => {
    expect(distanceToPitEntryM(0.98, 0.04, TRACK_M)).toBeCloseTo(240, 3);
  });

  it('reads a whole lap out just after passing the entry', () => {
    expect(distanceToPitEntryM(0.9, 0.9, TRACK_M)).toBe(0);
    expect(distanceToPitEntryM(0.91, 0.9, TRACK_M)).toBeCloseTo(3960, 3);
  });

  it('has nothing to say without a recorded lane, a track length or a position', () => {
    expect(distanceToPitEntryM(0.5, null, TRACK_M)).toBeNull();
    expect(distanceToPitEntryM(0.5, 0.9, 0)).toBeNull();
    expect(distanceToPitEntryM(-1, 0.9, TRACK_M)).toBeNull();
  });
});
