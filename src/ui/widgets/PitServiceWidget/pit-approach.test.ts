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

  it('fills the entry-to-stall leg on the way in, so 100% is the box', () => {
    // Halfway to a stall that sits at 0.6 of the lane.
    const view = buildPitApproachView({ ...baseInput, progressPct: 0.3 });

    expect(view.fill).toBeCloseTo(0.5, 6);
  });

  it('fills the stall-to-exit leg once the box is behind us', () => {
    const view = buildPitApproachView({
      ...baseInput,
      distMode: 'pitExit',
      progressPct: 0.8,
    });

    expect(view.fill).toBeCloseTo(0.5, 6);
    expect(view.isTargetExit).toBe(true);
  });

  it('falls back to the whole lane until the stall has been recorded', () => {
    const view = buildPitApproachView({
      ...baseInput,
      boxLanePct: null,
      laneLengthM: null,
      progressPct: 0.35,
    });

    expect(view.fill).toBeCloseTo(0.35, 6);
    expect(view.brakeMarker).toBeNull();
  });

  it('places the brake marker one braking distance before the end of the leg', () => {
    const view = buildPitApproachView(baseInput);
    const legLengthM = baseInput.boxLanePct! * baseInput.laneLengthM!;
    const expected = 1 - pitBrakeDistanceM(baseInput.speedMs) / legLengthM;

    expect(view.brakeMarker).toBeCloseTo(expected, 6);
  });

  it('drops the brake marker when the stop needs more lane than the leg has', () => {
    // 40 m/s needs 160 m to stop, more than the 80 m leg to a stall at 0.2.
    const view = buildPitApproachView({
      ...baseInput,
      speedMs: 40,
      boxLanePct: 0.2,
    });

    expect(view.brakeMarker).toBeNull();
  });

  it('clamps the leg fill to the bar', () => {
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
