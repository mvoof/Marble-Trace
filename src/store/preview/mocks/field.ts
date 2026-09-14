import type {
  CarEntry,
  CarPositionsFrame,
  DriverEntriesFrame,
  DriverEntry,
  IncidentPoint,
  IncidentsFrame,
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
  /**
   * Rows to state something extra about, keyed by their offset from the
   * player's own row — `-1` is the car directly ahead, `1` the car behind.
   *
   * The two tables scroll around the player, so an absolute index states a row
   * that may not be on screen. An offset states the row a reader is looking
   * at. Applied after the field is spaced, so it can contradict the pack — a
   * car sitting in its box is exactly that.
   */
  rows?: MockFieldRows;
}

/** Overrides for rows around the player, keyed by offset from the player. */
export type MockFieldRows = Record<number, Partial<DriverEntry>>;

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
// iRacing packs the flags waving at one car into a bit field, and the two
// tables read the driver's own three off it. Frozen here as the numbers the
// sim sends rather than taken from a live enum: a fixture states a bit, and
// what the widget makes of it is the widget's business.
const BLUE_FLAG_BIT = 0x00000020;
const MEATBALL_FLAG_BIT = 0x00100000;
const PENALTY_FLAG_BIT = 0x00010000;

/**
 * Three cars around the player at the three stages of a stop: one on the way
 * in, one standing in its box, one rejoining. What the pit column has to
 * distinguish, in one frame.
 */
export const MOCK_PIT_ROWS: MockFieldRows = {
  [-2]: { onPitRoad: true, pitState: 'in' },
  [-1]: { trackSurface: TrackSurface.InPitStall, pitState: 'stall' },
  [2]: { onPitRoad: true, pitState: 'exit' },
};

/** A blue, a meatball and a penalty on three rows — the flags a driver row draws. */
export const MOCK_DRIVER_FLAG_ROWS: MockFieldRows = {
  [-3]: { rawFlags: BLUE_FLAG_BIT },
  [-1]: { rawFlags: MEATBALL_FLAG_BIT },
  [1]: { rawFlags: PENALTY_FLAG_BIT },
};

const applyRows = (
  field: DriverEntry[],
  rows: MockFieldRows
): DriverEntry[] => {
  const playerIndex = Math.max(
    0,
    field.findIndex((entry) => entry.isPlayer)
  );

  return field.map((entry, index) => {
    const override = rows[index - playerIndex];

    return override ? { ...entry, ...override } : entry;
  });
};

export const mockField = (
  base: DriverEntry[],
  { gapS, lapTimeS = DEFAULT_LAP_TIME_S, rows }: MockFieldOptions
): MockFieldFrames => {
  const playerCarIdx = base.find((entry) => entry.isPlayer)?.carIdx ?? 0;
  const spaced = withClassPositions(spaceField(base, gapS, lapTimeS));
  const field = rows ? applyRows(spaced, rows) : spaced;
  const relativeEntries = [...field].sort(
    (first, second) => second.relativeLapDist - first.relativeLapDist
  );

  return {
    driverEntries: { entries: field, playerCarIdx },
    relative: { entries: relativeEntries, playerCarIdx },
  };
};

/**
 * The numbers behind `TrackSurface`, as the positions frame carries them.
 *
 * The driver list names the surface and the per-car arrays code it, so a
 * projection from one to the other has to state the pairing somewhere. It is
 * the sim's own, from the field's doc comment in `bindings.ts`.
 */
const TRACK_SURFACE_CODE: Record<TrackSurface, number> = {
  [TrackSurface.NotInWorld]: -1,
  [TrackSurface.OffTrack]: 0,
  [TrackSurface.InPitStall]: 1,
  [TrackSurface.AproachingPits]: 2,
  [TrackSurface.OnTrack]: 3,
};

/** What the sim reports for a car that is not in the world at all. */
const NOT_IN_WORLD = TRACK_SURFACE_CODE[TrackSurface.NotInWorld];

/** The code for a car running on the track surface itself. */
export const TRACK_SURFACE_ON_TRACK = TRACK_SURFACE_CODE[TrackSurface.OnTrack];

/**
 * The per-car position arrays, projected from the driver list.
 *
 * The snapshot carries the field as a roster and a `carIdx` frame, but the map
 * and the pace-car store read the positions frame — so a fixture that leaves it
 * out shows a map of nothing. Everything in it is already stated by the
 * entries, so it is projected rather than invented, and every index no entry
 * claims is left not-in-world.
 */
export const mockCarPositions = (entries: DriverEntry[]): CarPositionsFrame => {
  const maxCarIdx = entries.reduce(
    (highest, entry) => Math.max(highest, entry.carIdx),
    0
  );
  const size = maxCarIdx + 1;
  const lapDistPct = new Array<number>(size).fill(NOT_IN_WORLD);
  const trackSurface = new Array<number>(size).fill(NOT_IN_WORLD);

  for (const entry of entries) {
    lapDistPct[entry.carIdx] = entry.lapDistPct;
    trackSurface[entry.carIdx] = TRACK_SURFACE_CODE[entry.trackSurface];
  }

  return {
    car_idx_lap_dist_pct: lapDistPct,
    car_idx_track_surface: trackSurface,
  };
};

/** The car index a preview safety car is given, clear of every real entry. */
export const PACE_CAR_IDX = 61;

/**
 * A safety car as the session roster carries it.
 *
 * It is not a driver entry: it reaches the widgets through the roster and the
 * per-car arrays, so a fixture states one by adding this to `sessionInfo.cars`
 * and putting a lap distance on its index. Built from one of the session's own
 * cars, because everything else about it — the track, the class colors, the
 * screen names — has to stay the session's.
 */
export const mockPaceCarEntry = (
  template: CarEntry,
  overrides: Partial<CarEntry> = {}
): CarEntry => ({
  ...template,
  carIdx: PACE_CAR_IDX,
  userName: 'Pace Car',
  carNumber: '0',
  isPaceCar: true,
  ...overrides,
});

/**
 * The incident markers the track map draws, as the backend reports them.
 *
 * Two is the smallest set that states both halves of the widget: one car still
 * in trouble, so the zone blinks, and one already recovered, so the marker is
 * only lingering. Where they sit is a quarter of a lap apart, far enough that
 * neither hides behind the other whatever the track's shape.
 */
export const mockIncidents = (
  overrides: Partial<IncidentPoint>[] = []
): IncidentsFrame => {
  const points: IncidentPoint[] = [
    { carIdx: 1, lapDistPct: 0.43, kind: 'stopped', isActive: true },
    { carIdx: 2, lapDistPct: 0.78, kind: 'offTrack', isActive: false },
  ];

  return {
    incidents: points.map((point, index) => ({
      ...point,
      ...overrides[index],
    })),
  };
};
