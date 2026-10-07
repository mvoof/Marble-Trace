import { describe, expect, it } from 'vitest';

import type {
  CarEntry,
  DriverEntry as LiveDriverEntry,
} from '@/types/bindings';

import {
  DriverEntryJoin,
  joinDriverEntries,
  liveDriverEntryOf,
  rosterByCarIdx,
  sessionCarFieldsOf,
} from './driver-entry-join';

const makeCar = (carIdx: number, overrides: Partial<CarEntry> = {}): CarEntry =>
  ({
    carIdx,
    userName: `Driver ${carIdx}`,
    carNumber: String(carIdx),
    carClassId: 4029,
    carClassShortName: 'GT3',
    carClassColor: '#ffda59',
    carScreenName: 'Ferrari 296 GT3',
    carScreenNameShort: '296 GT3',
    flairId: 222,
    isAi: false,
    iRating: 2500,
    licString: 'A 3.21',
    licColor: '0x0153db',
    incidentCount: 4,
    ...overrides,
  }) as CarEntry;

const makeLive = (carIdx: number): LiveDriverEntry =>
  ({ carIdx, position: carIdx + 1, lapDistPct: 0.5 }) as LiveDriverEntry;

describe('joinDriverEntries', () => {
  it('puts the roster fields back on the live entry', () => {
    const [row] = joinDriverEntries(
      [makeLive(3)],
      rosterByCarIdx([makeCar(3)])
    );

    expect(row).toMatchObject({
      carIdx: 3,
      position: 4,
      lapDistPct: 0.5,
      userName: 'Driver 3',
      carClassId: 4029,
      flairId: 222,
      iRating: 2500,
      licString: 'A 3.21',
      incidents: 4,
    });
  });

  it('leaves out an entry the roster does not name yet', () => {
    const rows = joinDriverEntries(
      [makeLive(1), makeLive(2)],
      rosterByCarIdx([makeCar(1)])
    );

    expect(rows.map((row) => row.carIdx)).toEqual([1]);
  });

  it('shows a car with no licence on record as rookie zero', () => {
    const [row] = joinDriverEntries(
      [makeLive(1)],
      rosterByCarIdx([makeCar(1, { licString: '', licColor: '' })])
    );

    expect(row.licString).toBe('R 0.00');
    expect(row.licColor).toBe('000000');
  });

  it('lets the first driver listed speak for a shared car', () => {
    const roster = rosterByCarIdx([
      makeCar(5, { userName: 'Stint one' }),
      makeCar(5, { userName: 'Stint two' }),
    ]);

    expect(roster.get(5)?.userName).toBe('Stint one');
  });
});

describe('splitting a row back into its halves', () => {
  it('round-trips through the join', () => {
    const [row] = joinDriverEntries(
      [makeLive(2)],
      rosterByCarIdx([makeCar(2)])
    );
    const live = liveDriverEntryOf(row);
    const car = { ...makeCar(2, { userName: '' }), ...sessionCarFieldsOf(row) };

    expect(live).toEqual(makeLive(2));
    expect(joinDriverEntries([live], rosterByCarIdx([car]))).toEqual([row]);
  });
});

describe('DriverEntryJoin', () => {
  it('keeps the row of a car whose entries did not change', () => {
    const join = new DriverEntryJoin();
    const roster = rosterByCarIdx([makeCar(1), makeCar(2)]);
    const [firstParked, firstMoving] = join.join(
      [makeLive(1), makeLive(2)],
      roster
    );
    const [parked, moving] = join.join(
      [makeLive(1), { ...makeLive(2), lapDistPct: 0.6 }],
      roster
    );

    expect(parked).toBe(firstParked);
    expect(moving).not.toBe(firstMoving);
    expect(moving.lapDistPct).toBe(0.6);
  });

  it('rebuilds a row when the roster entry is replaced', () => {
    const join = new DriverEntryJoin();
    const [before] = join.join([makeLive(1)], rosterByCarIdx([makeCar(1)]));
    const [after] = join.join(
      [makeLive(1)],
      rosterByCarIdx([makeCar(1, { userName: 'Renamed' })])
    );

    expect(after).not.toBe(before);
    expect(after.userName).toBe('Renamed');
  });

  it('joins the same rows as the stateless join', () => {
    const roster = rosterByCarIdx([makeCar(1), makeCar(3)]);
    const entries = [makeLive(1), makeLive(2), makeLive(3)];

    expect(new DriverEntryJoin().join(entries, roster)).toEqual(
      joinDriverEntries(entries, roster)
    );
  });
});
