import type {
  DriverEntriesFrame,
  DriverEntry,
  RelativeFrame,
} from '@/types/bindings';
import { TrackSurface } from '@/types';

// Mock builders for the field domain — the driver list the standings and the
// relative draw. Pure: the field is varied on top of the snapshot's own drivers
// and returned as *complete* frames typed from the generated bindings, so a
// field added to the contract breaks this file rather than leaking silently
// into every fixture. Nothing here touches a store.
//
// Deliberately small. The snapshot already holds a full three-class grid, the
// longest names a driver can carry and six cars sitting in their boxes, so the
// only thing a field scenario has left to state is how close the cars run —
// which is the one state a recording cannot be asked for.

export interface MockFieldOptions {
  /** Seconds between one car and the next, on track and in the gap column. */
  gapS: number;
  /** The lap time the gaps are measured against. */
  lapTimeS?: number;
}

export interface MockFieldFrames {
  driverEntries: DriverEntriesFrame;
  relative: RelativeFrame;
}

const DEFAULT_LAP_TIME_S = 92.4;
/** Where the player sits on the lap; the rest of the field is spaced around it. */
const PLAYER_LAP_DIST_PCT = 0.5;
/** Spread over the field's lap times so no two cars read the same. */
const LAP_TIME_SPREAD_S = 0.09;
const PLAYER_LAP = 12;

const signedLapDistDiff = (lapDistPct: number): number => {
  let diff = lapDistPct - PLAYER_LAP_DIST_PCT;

  if (diff > 0.5) {
    diff -= 1;
  }

  if (diff < -0.5) {
    diff += 1;
  }

  return diff;
};

// Every car a fixed gap behind the one in front of it: the standings read that
// off `f2Time` and the relative off `estTime` plus the lap distance, so both
// are spaced from the same number or the two widgets disagree.
//
// The gap is turned into a *continuous* distance first — laps and the fraction
// of a lap together. A field placed by the fraction alone would fold its tail
// back alongside the leaders with nothing on either row saying "lapped": the
// relative would draw them on the player's bumper while the standings reported
// them a lap down.
const spaceField = (
  field: DriverEntry[],
  gapS: number,
  lapTimeS: number
): DriverEntry[] => {
  const playerIndex = Math.max(
    0,
    field.findIndex((entry) => entry.isPlayer)
  );
  const playerProgress = PLAYER_LAP + PLAYER_LAP_DIST_PCT;

  return field.map((entry, index) => {
    const progress = playerProgress + ((playerIndex - index) * gapS) / lapTimeS;
    const lap = Math.floor(progress);
    const lapTime = lapTimeS + index * LAP_TIME_SPREAD_S;
    const lapDistPct = progress - lap;

    return {
      ...entry,
      position: index + 1,
      livePosition: index + 1,
      startPosOverall: index + 1,
      // The whole field is put back on track. Fourteen of the snapshot's cars
      // were recorded out of the world and six sitting in their boxes, and a
      // pack is not a pack with a fifth of it parked — the baseline is where
      // those rows are looked at, not here.
      onPitRoad: false,
      pitState: 'none' as const,
      trackSurface: TrackSurface.OnTrack,
      lap,
      lapDistPct,
      relativeLapDist: signedLapDistDiff(lapDistPct),
      estTime: lapDistPct * lapTimeS,
      classEstLapTime: lapTimeS,
      f2Time: index * gapS,
      // Half the snapshot's field never set a lap, which would leave the lap
      // time columns blank in the one scenario written to size them.
      lastLapTime: lapTime,
      bestLapTime: lapTime - LAP_TIME_SPREAD_S,
      qualifyTime: lapTime,
      // The gap column prefers the sim's own results gap and falls back to
      // `f2Time`; the snapshot carries neither, so the fallback is the path the
      // preview draws and these stay unset.
      resultsPositionLap: null,
      resultsPositionTime: null,
    };
  });
};

const withClassPositions = (field: DriverEntry[]): DriverEntry[] => {
  const seenPerClass = new Map<number, number>();

  return field.map((entry) => {
    const classPosition = (seenPerClass.get(entry.carClassId) ?? 0) + 1;

    seenPerClass.set(entry.carClassId, classPosition);

    return {
      ...entry,
      classPosition,
      liveClassPosition: classPosition,
      startPosClass: classPosition,
    };
  });
};

/**
 * The snapshot's own drivers, closed up to a stated gap.
 *
 * The drivers, their classes, their names and the session header all stay the
 * snapshot's — nobody hand-writes a field. What a scenario states is only the
 * one thing a recording cannot be asked for: how close the cars are running.
 */
export const mockField = (
  base: DriverEntry[],
  { gapS, lapTimeS = DEFAULT_LAP_TIME_S }: MockFieldOptions
): MockFieldFrames => {
  const playerCarIdx = base.find((entry) => entry.isPlayer)?.carIdx ?? 0;
  const field = withClassPositions(spaceField(base, gapS, lapTimeS));
  const relativeEntries = [...field].sort(
    (first, second) => second.relativeLapDist - first.relativeLapDist
  );

  return {
    driverEntries: { entries: field, playerCarIdx },
    relative: { entries: relativeEntries, playerCarIdx },
  };
};
