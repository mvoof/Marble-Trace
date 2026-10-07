import type {
  CarEntry,
  DriverEntry as LiveDriverEntry,
} from '@shared/contracts/bindings';
import { SESSION_CAR_FIELDS, type DriverEntry } from '@/types/driver-entry';

/** What a car with no licence on record shows — AI and some hosted entries. */
const DEFAULT_LIC_STRING = 'R 0.00';
const DEFAULT_LIC_COLOR = '000000';

const SESSION_CAR_FIELD_PAIRS = Object.entries(SESSION_CAR_FIELDS) as [
  keyof typeof SESSION_CAR_FIELDS,
  keyof CarEntry,
][];

/**
 * The roster by car index. In a team race several drivers share a car; the
 * first one listed speaks for it, the same pick the backend makes when it
 * builds the live entries.
 */
export const rosterByCarIdx = (cars: CarEntry[]): Map<number, CarEntry> => {
  const roster = new Map<number, CarEntry>();

  for (const car of cars) {
    if (!roster.has(car.carIdx)) {
      roster.set(car.carIdx, car);
    }
  }

  return roster;
};

const joinedRowOf = (entry: LiveDriverEntry, car: CarEntry): DriverEntry => ({
  ...entry,
  userName: car.userName,
  carNumber: car.carNumber,
  carClassId: car.carClassId,
  carClassShortName: car.carClassShortName,
  carClassColor: car.carClassColor,
  carScreenName: car.carScreenName,
  carScreenNameShort: car.carScreenNameShort,
  flairId: car.flairId,
  isAi: car.isAi,
  iRating: car.iRating,
  licString: car.licString || DEFAULT_LIC_STRING,
  licColor: car.licColor || DEFAULT_LIC_COLOR,
  incidents: car.incidentCount,
});

/**
 * The live entries with each car's session fields put back on. An entry whose
 * car the roster does not hold yet — a frame that arrived a tick ahead of the
 * session update naming the car — is left out until it does, rather than drawn
 * as a nameless row.
 */
export const joinDriverEntries = (
  entries: LiveDriverEntry[],
  roster: ReadonlyMap<number, CarEntry>
): DriverEntry[] => {
  const joined: DriverEntry[] = [];

  for (const entry of entries) {
    const car = roster.get(entry.carIdx);

    if (car) {
      joined.push(joinedRowOf(entry, car));
    }
  }

  return joined;
};

interface JoinedRow {
  live: LiveDriverEntry;
  car: CarEntry;
  row: DriverEntry;
}

const isSameLiveEntry = (
  previous: LiveDriverEntry,
  next: LiveDriverEntry
): boolean => {
  for (const field in next) {
    if (
      previous[field as keyof LiveDriverEntry] !==
      next[field as keyof LiveDriverEntry]
    ) {
      return false;
    }
  }

  return true;
};

/**
 * `joinDriverEntries` that keeps each car's row from the last call while
 * neither its live entry nor its roster entry changed. Repeat suppression
 * keeps an unchanged frame off the wire, but a frame in which one car moved
 * still carries all of them — a parked or retired car keeps its row here.
 */
export class DriverEntryJoin {
  private readonly byCarIdx = new Map<number, JoinedRow>();

  join(
    entries: LiveDriverEntry[],
    roster: ReadonlyMap<number, CarEntry>
  ): DriverEntry[] {
    const joined: DriverEntry[] = [];

    for (const entry of entries) {
      const car = roster.get(entry.carIdx);

      if (!car) {
        continue;
      }

      const previous = this.byCarIdx.get(entry.carIdx);

      if (
        previous &&
        previous.car === car &&
        isSameLiveEntry(previous.live, entry)
      ) {
        joined.push(previous.row);

        continue;
      }

      const row = joinedRowOf(entry, car);

      this.byCarIdx.set(entry.carIdx, { live: entry, car, row });
      joined.push(row);
    }

    return joined;
  }

  clear() {
    this.byCarIdx.clear();
  }
}

/** The wire half of a row: what the backend sends for it every tick. */
export const liveDriverEntryOf = (row: DriverEntry): LiveDriverEntry => {
  const live: Partial<DriverEntry> = { ...row };

  for (const [rowField] of SESSION_CAR_FIELD_PAIRS) {
    delete live[rowField];
  }

  return live as LiveDriverEntry;
};

/**
 * The roster half of a row, as `CarEntry` fields — what a fixture that states
 * whole rows writes into the session so the join hands the same row back.
 */
export const sessionCarFieldsOf = (row: DriverEntry): Partial<CarEntry> =>
  Object.fromEntries(
    SESSION_CAR_FIELD_PAIRS.map(([rowField, carField]) => [
      carField,
      row[rowField],
    ])
  );
