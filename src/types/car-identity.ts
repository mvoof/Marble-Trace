import type { DriverEntry } from './driver-entry';

/**
 * The fields of a `DriverEntry` that move on every telemetry tick. Everything
 * else in the entry — name, number, class, licence, rating, positions, flags —
 * changes at most once a lap.
 *
 * The split is what lets a row or a dot be rendered by React from a value that
 * is stable across a burst, while the numbers below are written straight to the
 * DOM — or read from the full entry by a store that wants them. See `docs/rendering.md`.
 */
export const MOVING_CAR_FIELDS = [
  'lapDistPct',
  'relativeLapDist',
  'estTime',
  'f2Time',
  'speed',
] as const;

/** A car as it is drawn: the whole entry apart from what moves every tick. */
export type CarIdentity = Omit<DriverEntry, (typeof MOVING_CAR_FIELDS)[number]>;
