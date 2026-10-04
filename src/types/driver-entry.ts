import type { CarEntry, DriverEntry as LiveDriverEntry } from './bindings';

/**
 * The fields a driver row reads from the session roster rather than from the
 * 10 Hz frame, keyed by the name a row reads them under and naming the
 * `CarEntry` field each one comes from.
 *
 * Who a car is — driver, number, class, car, licence, rating — holds for the
 * whole session, so the backend sends it once in `SessionSnapshot.cars` and
 * leaves it off every `DriverEntry` tick.
 */
export const SESSION_CAR_FIELDS = {
  userName: 'userName',
  carNumber: 'carNumber',
  carClassId: 'carClassId',
  carClassShortName: 'carClassShortName',
  carClassColor: 'carClassColor',
  carScreenName: 'carScreenName',
  carScreenNameShort: 'carScreenNameShort',
  flairId: 'flairId',
  isAi: 'isAi',
  iRating: 'iRating',
  licString: 'licString',
  licColor: 'licColor',
  incidents: 'incidentCount',
} as const satisfies Record<string, keyof CarEntry>;

type SessionCarFields = {
  [Field in keyof typeof SESSION_CAR_FIELDS]: CarEntry[(typeof SESSION_CAR_FIELDS)[Field]];
};

/**
 * A car as every widget reads it: the live frame the backend sends at 10 Hz,
 * joined by `carIdx` with the car's own entry in the session roster.
 *
 * Built in one place — `BackendComputedStore` — and nowhere else. The bindings
 * type of the same name is the wire half only.
 */
export type DriverEntry = LiveDriverEntry & SessionCarFields;
