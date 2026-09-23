import type { DriverEntry } from '@/types/bindings';
import { TrackSurface } from '@/types';
import { computeRelativeGap } from '@ui/widgets/RelativeWidget/relative-utils';

/** Segments in each speed bar. */
export const SPEED_SEGMENT_COUNT = 7;

/** What an even fight lights: a little over half, so both bars read as alive. */
const EVEN_FIGHT_SEGMENTS = 4;

/**
 * m/s of speed difference per segment — about 3.6 km/h. Past three segments
 * either way (roughly 11 km/h) the faster car is simply faster, and the bars
 * have said so already.
 */
const MPS_PER_SEGMENT = 1;

/**
 * Past this much of a lap apart the car is traffic, not a fight — the same
 * threshold the Relative and Close Battle widgets call a car lapped by.
 */
const LAPPED_THRESHOLD = 0.5;

/** A fight leaves at 1.3 × the threshold, or it blinks on every straight. */
export const LEAVE_HYSTERESIS = 1.3;

export interface WheelToWheelOpponent {
  entry: DriverEntry;
  /** Relative-widget convention: the opponent ahead reads negative. */
  gapSeconds: number;
}

const lapProgress = (entry: DriverEntry): number =>
  entry.lap + entry.lapDistPct;

const isRacingOnTrack = (entry: DriverEntry): boolean =>
  !entry.onPitRoad &&
  entry.trackSurface !== TrackSurface.NotInWorld &&
  entry.trackSurface !== TrackSurface.InPitStall;

const isOnSameLap = (entry: DriverEntry, player: DriverEntry): boolean =>
  Math.abs(lapProgress(entry) - lapProgress(player)) < LAPPED_THRESHOLD;

export interface WheelToWheelRivals {
  ahead: WheelToWheelOpponent | null;
  behind: WheelToWheelOpponent | null;
}

export interface PickRivalsOptions {
  thresholdSeconds: number;
  heldAheadIdx: number | null;
  heldBehindIdx: number | null;
  excludedCarIdxs: ReadonlySet<number>;
  /**
   * Drop cars a lap apart. Only ever true in a race: anywhere else every car
   * joined at its own time, so a lap count says nothing about who you fight.
   */
  countsLaps: boolean;
}

/**
 * Nearest from one side, keeping the car already drawn there while it stays
 * inside the widened threshold — two rivals trading a tenth never swap the
 * plate from one tick to the next.
 */
const pickFromSide = (
  candidates: WheelToWheelOpponent[],
  heldCarIdx: number | null,
  thresholdSeconds: number
): WheelToWheelOpponent | null => {
  const held = candidates.find(
    (candidate) => candidate.entry.carIdx === heldCarIdx
  );

  if (
    held &&
    Math.abs(held.gapSeconds) <= thresholdSeconds * LEAVE_HYSTERESIS
  ) {
    return held;
  }

  const nearest = candidates
    .filter((candidate) => Math.abs(candidate.gapSeconds) <= thresholdSeconds)
    .sort(
      (first, second) =>
        Math.abs(first.gapSeconds) - Math.abs(second.gapSeconds)
    );

  return nearest[0] ?? null;
};

/**
 * Who you are fighting, one car per side: the nearest car of your own class
 * ahead and the nearest behind, each inside the threshold.
 */
export const pickRivals = (
  entries: DriverEntry[],
  player: DriverEntry,
  options: PickRivalsOptions
): WheelToWheelRivals => {
  const candidates = entries
    .filter(
      (entry) =>
        !entry.isPlayer &&
        !options.excludedCarIdxs.has(entry.carIdx) &&
        entry.carClassId === player.carClassId &&
        isRacingOnTrack(entry) &&
        (!options.countsLaps || isOnSameLap(entry, player))
    )
    .map((entry) => ({ entry, gapSeconds: computeRelativeGap(entry, player) }));

  return {
    ahead: pickFromSide(
      candidates.filter((candidate) => candidate.gapSeconds < 0),
      options.heldAheadIdx,
      options.thresholdSeconds
    ),
    behind: pickFromSide(
      candidates.filter((candidate) => candidate.gapSeconds >= 0),
      options.heldBehindIdx,
      options.thresholdSeconds
    ),
  };
};

/**
 * Segments lit on one side's bar: half for an even fight, more for the car
 * carrying more speed, fewer for the one losing it. `null` while either speed
 * is still unknown — a bar guessing at a comparison is worse than none.
 */
export const litSpeedSegments = (
  ownSpeed: number,
  otherSpeed: number
): number | null => {
  if (ownSpeed <= 0 || otherSpeed <= 0) {
    return null;
  }

  const lit = Math.round(
    EVEN_FIGHT_SEGMENTS + (ownSpeed - otherSpeed) / MPS_PER_SEGMENT
  );

  return Math.min(SPEED_SEGMENT_COUNT, Math.max(1, lit));
};

/**
 * The gap as the plate prints it: from the player's side, so `+` is you in
 * front. The sign is always there and the digits always three decimals, so
 * the readout never re-centres as the fight swings.
 */
export const formatBattleGap = (gapSeconds: number): string => {
  const sign = gapSeconds >= 0 ? '+' : '-';

  return `${sign}${Math.abs(gapSeconds).toFixed(3)}`;
};
