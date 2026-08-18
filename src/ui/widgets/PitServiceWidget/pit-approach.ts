import type { PitTargetType } from '@/types/bindings';

/**
 * The approach rail: how far the box still is, where it sits along the pit
 * lane, and when the braking has to start to stop in it.
 *
 * The sim gives us the distance and the lane progress; everything the driver
 * reads off the rail is derived here so the component stays a painter.
 */
export interface PitApproachInput {
  /** Meters to the current target, from `pit_target_dist_m`. */
  distM: number | null;
  /** Whether the distance counts down to the stall or to the pit exit. */
  distMode: PitTargetType | null;
  /** Position along the pit lane, 0..1. */
  progressPct: number | null;
  /** Pit lane length in meters — null until the lane has been recorded. */
  laneLengthM: number | null;
  /** Where the stall sits along the lane, 0..1 — null until recorded. */
  boxLanePct: number | null;
  speedMs: number;
  /** Distance at which the countdown turns from "far" to "coming up". */
  cueDistM: number;
  withBrakeCue: boolean;
}

export type PitApproachUrgency = 'far' | 'near' | 'brake' | 'arrived';

export interface PitApproachView {
  urgency: PitApproachUrgency;
  /** Lane fill, 0..1. */
  fill: number;
  /** Stall patch along the lane, both 0..1. Null while the lane is unrecorded. */
  boxLeft: number | null;
  boxWidth: number | null;
  /** Where braking has to start, 0..1 along the lane. Null when it does not apply. */
  brakeMarker: number | null;
  /** Braking distance at the current speed, in meters. */
  brakeDistM: number;
  isTargetExit: boolean;
}

/**
 * Deceleration the marker is placed for, m/s². A pit-lane stop is a roll to a
 * halt, not a stab at the pedal — braking harder than this in the box is how
 * cars overshoot the stall, and a marker placed for a heroic stop would be
 * telling the driver to arrive too fast.
 */
export const PIT_BRAKE_DECEL_MPS2 = 5;

/** Meters either side of the stall painted as the box patch. */
const BOX_ZONE_M = 6;
/** On a long lane the patch would collapse to a hairline without a floor. */
const BOX_ZONE_MIN = 0.02;
const BOX_ZONE_MAX = 0.14;

/** Within this many meters the car is at the stall — stop, do not creep. */
const ARRIVED_M = 3;

/**
 * How much of the braking distance is given away before the cue lights up. The
 * marker is a "start now" line, so it has to arrive slightly early to be
 * actionable at all.
 */
const BRAKE_CUE_MARGIN = 1.15;

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

/**
 * Meters still to drive to the pit entry line, going forwards round the lap.
 * Null while the lane has not been recorded or the track length is unknown.
 *
 * The sim has no "driver is heading for the pits" signal of any kind — no flag,
 * no state, nothing on the service order that is not set laps in advance. The
 * distance to the entry the lane recording already gave us is the whole detect:
 * it is geometry, so it is exact, and it costs nothing extra.
 */
export const distanceToPitEntryM = (
  lapDistPct: number | null | undefined,
  pitInPct: number | null | undefined,
  trackLengthM: number | null | undefined
): number | null => {
  if (
    lapDistPct == null ||
    lapDistPct < 0 ||
    pitInPct == null ||
    trackLengthM == null ||
    trackLengthM <= 0
  ) {
    return null;
  }

  return ((pitInPct - lapDistPct + 1) % 1) * trackLengthM;
};

export const pitBrakeDistanceM = (speedMs: number): number =>
  (speedMs * speedMs) / (2 * PIT_BRAKE_DECEL_MPS2);

export const buildPitApproachView = (
  input: PitApproachInput
): PitApproachView => {
  const {
    distM,
    distMode,
    progressPct,
    laneLengthM,
    boxLanePct,
    speedMs,
    cueDistM,
    withBrakeCue,
  } = input;

  const isTargetExit = distMode === 'pitExit';
  const brakeDistM = pitBrakeDistanceM(speedMs);

  const boxWidth =
    boxLanePct === null
      ? null
      : laneLengthM !== null && laneLengthM > 0
        ? Math.min(
            Math.max(BOX_ZONE_M / laneLengthM, BOX_ZONE_MIN),
            BOX_ZONE_MAX
          )
        : BOX_ZONE_MIN;

  const boxLeft =
    boxLanePct === null || boxWidth === null
      ? null
      : clamp01(boxLanePct - boxWidth / 2);

  const urgency: PitApproachUrgency = (() => {
    // Past the stall the rail stops nagging: the target is the exit line, and
    // there is nothing to brake for.
    if (isTargetExit || distM === null) {
      return 'far';
    }

    if (distM <= ARRIVED_M) {
      return 'arrived';
    }

    if (withBrakeCue && distM <= brakeDistM * BRAKE_CUE_MARGIN) {
      return 'brake';
    }

    return distM <= cueDistM ? 'near' : 'far';
  })();

  // The marker only means something while it is still ahead of the car and
  // inside the lane — a stop that needs more room than is left is not a cue,
  // it is the brake urgency above.
  const brakeMarker = (() => {
    if (
      !withBrakeCue ||
      isTargetExit ||
      boxLanePct === null ||
      laneLengthM === null ||
      laneLengthM <= 0 ||
      brakeDistM <= 0
    ) {
      return null;
    }

    const marker = boxLanePct - brakeDistM / laneLengthM;

    return marker <= 0 ? null : marker;
  })();

  return {
    urgency,
    fill: clamp01(progressPct ?? 0),
    boxLeft,
    boxWidth,
    brakeMarker,
    brakeDistM,
    isTargetExit,
  };
};
