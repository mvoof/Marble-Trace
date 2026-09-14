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

/**
 * One class in a mocked field. `carClassId` only groups the cars and colours
 * the badge — the preview has no backend to resolve a class against, so the
 * badge is stated rather than derived.
 */
export interface MockFieldClass {
  carClassId: number;
  badge: string;
  color: string;
  carScreenName: string;
  carScreenNameShort: string;
  /** How many cars of this class the field holds, relative to the others. */
  weight: number;
}

export interface MockFieldOptions {
  /** Cars in the field. Defaults to however many the snapshot has. */
  size?: number;
  /** Defaults to the mix the snapshot recorded. */
  classes?: MockFieldClass[];
  /** Characters every driver name is stretched or trimmed to. */
  nameLength?: number;
  /** Seconds between one car and the next, on track and in the gap column. */
  gapS?: number;
  /** The lap time the gaps are measured against. */
  lapTimeS?: number;
  /** Put cars on pit road, in a stall and on their way out. */
  pitStates?: boolean;
}

export interface MockFieldFrames {
  driverEntries: DriverEntriesFrame;
  relative: RelativeFrame;
}

/** A surname long enough to fill any realistic name column. */
const LONG_NAME_FILLER = 'Vandersteen-Oliveira';
const DEFAULT_LAP_TIME_S = 92.4;
const DEFAULT_GAP_S = 1.6;
/** Where the player sits on the lap; the rest of the field is spaced around it. */
const PLAYER_LAP_DIST_PCT = 0.5;
/** Spread over the field's lap times so no two cars read the same. */
const LAP_TIME_SPREAD_S = 0.09;
const PLAYER_LAP = 12;

/**
 * The four-class endurance grid — the widest the badge and colour columns ever
 * have to be. The ids group the cars and nothing else.
 */
export const MOCK_ENDURANCE_CLASSES: MockFieldClass[] = [
  {
    carClassId: 9001,
    badge: 'GTP',
    color: '#ff4d4f',
    carScreenName: 'Acura ARX-06 GTP',
    carScreenNameShort: 'ARX-06',
    weight: 2,
  },
  {
    carClassId: 9002,
    badge: 'LMP2',
    color: '#2f86ff',
    carScreenName: 'Dallara P217 LMP2',
    carScreenNameShort: 'P217',
    weight: 2,
  },
  {
    carClassId: 9003,
    badge: 'GT3',
    color: '#ffd259',
    carScreenName: 'Ferrari 296 GT3',
    carScreenNameShort: '296 GT3',
    weight: 3,
  },
  {
    carClassId: 9004,
    badge: 'GT4',
    color: '#52c41a',
    carScreenName: 'Porsche 718 Cayman GT4 Clubsport MR',
    carScreenNameShort: '718 GT4',
    weight: 3,
  },
];

/** The everyday single-make grid, for judging the ordinary look. */
export const MOCK_SINGLE_CLASS: MockFieldClass[] = [
  {
    carClassId: 4102,
    badge: 'M2',
    color: '#ffd259',
    carScreenName: 'BMW M2 Racing (G87)',
    carScreenNameShort: 'BMW M2',
    weight: 1,
  },
];

const stretchName = (name: string, length: number): string => {
  let padded = name;

  while (padded.length < length) {
    padded = `${padded} ${LONG_NAME_FILLER}`;
  }

  return padded.slice(0, length).trim();
};

/**
 * Given names for the cloned rounds. A clone is told apart by its *first* name
 * rather than a suffix: the name column is trimmed from the end, so a suffix on
 * a name already at the column's length is cut straight back off and two rows
 * end up reading the same.
 */
const CLONE_GIVEN_NAMES = [
  'Aleksander',
  'Konstantin',
  'Bartholomew',
  'Massimiliano',
  'Thaddeus',
];

// Cloned rather than sliced when the field is larger than the snapshot: the
// snapshot holds the drivers, and a scenario that wants sixty of them has to
// get the rest from somewhere. Each copy takes its own car index and number so
// nothing downstream keys two rows the same.
const cloneField = (base: DriverEntry[], size: number): DriverEntry[] => {
  const maxCarIdx = base.reduce(
    (highest, entry) => Math.max(highest, entry.carIdx),
    0
  );

  return Array.from({ length: size }, (_unused, index) => {
    const source = base[index % base.length] as DriverEntry;
    const round = Math.floor(index / base.length);

    if (round === 0) {
      return { ...source };
    }

    const givenName =
      CLONE_GIVEN_NAMES[(round - 1) % CLONE_GIVEN_NAMES.length] ?? 'Alex';

    return {
      ...source,
      carIdx: maxCarIdx + index + 1,
      carNumber: `${source.carNumber}${round}`,
      userName: `${givenName} ${source.userName}`,
      isPlayer: false,
    };
  });
};

// Shrinking keeps the player: the field is ordered by position, and a driver
// running at the back would otherwise be sliced off his own preview.
const trimField = (base: DriverEntry[], size: number): DriverEntry[] => {
  const kept = base.slice(0, size);

  if (kept.some((entry) => entry.isPlayer)) {
    return kept;
  }

  const player = base.find((entry) => entry.isPlayer);

  if (!player || kept.length === 0) {
    return kept;
  }

  return [...kept.slice(0, kept.length - 1), player];
};

const resizeField = (base: DriverEntry[], size: number): DriverEntry[] =>
  size < base.length ? trimField(base, size) : cloneField(base, size);

// Largest-remainder round robin, so the classes interleave down the order the
// way a real multi-class grid does instead of arriving in solid blocks.
const assignClasses = (
  field: DriverEntry[],
  classes: MockFieldClass[]
): DriverEntry[] => {
  const totalWeight = classes.reduce(
    (sum, carClass) => sum + carClass.weight,
    0
  );
  const credit = classes.map(() => 0);

  return field.map((entry) => {
    classes.forEach((carClass, index) => {
      credit[index] = (credit[index] ?? 0) + carClass.weight / totalWeight;
    });

    let pickedIndex = 0;

    credit.forEach((value, index) => {
      if (value > (credit[pickedIndex] ?? 0)) {
        pickedIndex = index;
      }
    });

    const picked = classes[pickedIndex] as MockFieldClass;

    credit[pickedIndex] = (credit[pickedIndex] ?? 0) - 1;

    return {
      ...entry,
      carClassId: picked.carClassId,
      carClassShortName: picked.badge,
      carClassColor: picked.color,
      carScreenName: picked.carScreenName,
      carScreenNameShort: picked.carScreenNameShort,
    };
  });
};

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
// of a lap together. A sixty-car grid spans more than one lap, and a field
// placed by the fraction alone would fold its tail back alongside the leaders
// with nothing on either row saying "lapped": the relative would draw them on
// the player's bumper while the standings reported them two minutes down.
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
    const lapDistPct = progress - lap;
    const lapTime = lapTimeS + index * LAP_TIME_SPREAD_S;

    return {
      ...entry,
      position: index + 1,
      // The field is put back on track wholesale. The snapshot recorded seven
      // cars in the pits, and left as they were they would draw pit styling on
      // rows the scenario has just spaced evenly around the lap — and would
      // clutter the pit scenario, whose point is the three rows it badges.
      onPitRoad: false,
      pitState: 'none' as const,
      trackSurface: TrackSurface.OnTrack,
      livePosition: index + 1,
      startPosOverall: index + 1,
      lap,
      lapDistPct,
      relativeLapDist: signedLapDistDiff(lapDistPct),
      estTime: lapDistPct * lapTimeS,
      classEstLapTime: lapTimeS,
      f2Time: index * gapS,
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

/** Offsets from the player's row, so the pit rows land where they are visible. */
const PIT_ROW_IN_OFFSET = 2;
const PIT_ROW_STALL_OFFSET = 3;
const PIT_ROW_EXIT_OFFSET = -2;

const withPitStates = (field: DriverEntry[]): DriverEntry[] => {
  const playerIndex = Math.max(
    0,
    field.findIndex((entry) => entry.isPlayer)
  );

  return field.map((entry, index) => {
    const offset = index - playerIndex;

    if (offset === PIT_ROW_IN_OFFSET) {
      return {
        ...entry,
        onPitRoad: true,
        pitState: 'in' as const,
        trackSurface: TrackSurface.AproachingPits,
      };
    }

    if (offset === PIT_ROW_STALL_OFFSET) {
      return {
        ...entry,
        onPitRoad: true,
        pitState: 'stall' as const,
        trackSurface: TrackSurface.InPitStall,
      };
    }

    if (offset === PIT_ROW_EXIT_OFFSET) {
      return {
        ...entry,
        onPitRoad: true,
        pitState: 'exit' as const,
        trackSurface: TrackSurface.AproachingPits,
      };
    }

    return entry;
  });
};

/**
 * A field of drivers, varied on top of the snapshot's own.
 *
 * The snapshot stays the source of the drivers, the track and the session
 * header — nobody hand-writes sixty names. What a scenario states is only what
 * it is about: how many cars, which classes, how long the names are, how close
 * the gaps, and who is in the pits.
 */
export const mockField = (
  base: DriverEntry[],
  options: MockFieldOptions = {}
): MockFieldFrames => {
  const playerCarIdx = base.find((entry) => entry.isPlayer)?.carIdx ?? 0;

  if (base.length === 0) {
    return {
      driverEntries: { entries: [], playerCarIdx },
      relative: { entries: [], playerCarIdx },
    };
  }

  const {
    size = base.length,
    classes,
    nameLength,
    gapS = DEFAULT_GAP_S,
    lapTimeS = DEFAULT_LAP_TIME_S,
    pitStates = false,
  } = options;

  let field = resizeField(base, size);

  if (classes) {
    field = assignClasses(field, classes);
  }

  if (nameLength !== undefined) {
    field = field.map((entry) => ({
      ...entry,
      userName: stretchName(entry.userName, nameLength),
    }));
  }

  field = withClassPositions(spaceField(field, gapS, lapTimeS));

  if (pitStates) {
    field = withPitStates(field);
  }

  const relativeEntries = [...field].sort(
    (first, second) => second.relativeLapDist - first.relativeLapDist
  );

  return {
    driverEntries: { entries: field, playerCarIdx },
    relative: { entries: relativeEntries, playerCarIdx },
  };
};
