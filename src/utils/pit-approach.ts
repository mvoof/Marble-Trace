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
  withBrakeCue: boolean;
}

/**
 * What the rail is saying, and nothing the driver has to configure: the two
 * states that are not 'far' are both geometry — one braking distance out at the
 * current speed, and standing in the stall.
 */
export type PitApproachUrgency = 'far' | 'brake' | 'arrived';

export interface PitApproachView {
  urgency: PitApproachUrgency;
  /**
   * Length of the bar, 0..1, always measured from the foot of the column.
   *
   * The rail is never the whole pit lane, and the bar is never a progress bar:
   * it is the room still to be driven, and the box is the end it moves towards.
   * On the way in the box sits at the top and the bar grows to it; once the box
   * is behind us it sits at the foot and the bar shrinks back down to the exit
   * behind it. Either way a full bar is far and an empty one is there.
   */
  fill: number;
  /** Where braking has to start, 0..1 along the leg. Null when it does not apply. */
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
    withBrakeCue,
  } = input;

  const isTargetExit = distMode === 'pitExit';
  const brakeDistM = pitBrakeDistanceM(speedMs);

  // The leg the rail is drawing: entry → stall on the way in, stall → exit on
  // the way out. Until the lane has been recorded there is no stall to split it
  // at, so the whole lane stands in for the leg.
  const legStart = boxLanePct === null ? 0 : isTargetExit ? boxLanePct : 0;
  const legEnd = boxLanePct === null ? 1 : isTargetExit ? 1 : boxLanePct;
  const legSpan = legEnd - legStart;

  const legLengthM =
    laneLengthM === null || laneLengthM <= 0 ? null : legSpan * laneLengthM;

  const legProgress =
    legSpan <= 0 ? 1 : clamp01(((progressPct ?? 0) - legStart) / legSpan);

  // In: grows towards the box at the ceiling. Out: the box is behind the car,
  // so the same bar drains back down towards it.
  const fill = isTargetExit ? 1 - legProgress : legProgress;

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

    return 'far';
  })();

  // The leg ends at the stall, so the marker is one braking distance back from
  // its far end. It only means something while it is still inside the leg — a
  // stop that needs more room than the leg has is not a cue, it is the brake
  // urgency above.
  const brakeMarker = (() => {
    if (
      !withBrakeCue ||
      isTargetExit ||
      legLengthM === null ||
      legLengthM <= 0 ||
      brakeDistM <= 0
    ) {
      return null;
    }

    const marker = 1 - brakeDistM / legLengthM;

    return marker <= 0 ? null : marker;
  })();

  return {
    urgency,
    fill,
    brakeMarker,
    brakeDistM,
    isTargetExit,
  };
};
