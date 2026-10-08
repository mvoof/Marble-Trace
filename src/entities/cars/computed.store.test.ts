import { describe, it, expect, beforeEach } from 'vitest';
import { runInAction } from 'mobx';
import { BackendComputedStore } from './computed.store';
import { SessionStore } from '../session/session.store';
import type {
  CarEntry,
  DriverEntriesFrame,
  DriverEntry,
  LapLogFrame,
  SessionSnapshot,
} from '@shared/contracts/bindings';

const makeFrame = (
  history: LapLogFrame['history'],
  lastCompletedLap: LapLogFrame['lastCompletedLap'] = null
): LapLogFrame => ({
  history,
  lastCompletedLap,
});

describe('BackendComputedStore lap log buffer', () => {
  let store: BackendComputedStore;

  beforeEach(() => {
    store = new BackendComputedStore(new SessionStore());
  });

  it('starts empty', () => {
    expect(store.lapHistory).toHaveLength(0);
    expect(store.lastCompletedLap).toBeNull();
  });

  it('updateLapLog stores history and lastCompletedLap', () => {
    const frame = makeFrame(
      [{ lapNum: 1, lapTime: 90.0, delta: null, isBest: true }],
      { lapNum: 1, delta: null }
    );

    runInAction(() => store.updateLapLog(frame));

    expect(store.lapHistory).toHaveLength(1);
    expect(store.lapHistory[0]).toMatchObject({
      lapNum: 1,
      lapTime: 90.0,
      isBest: true,
    });
    expect(store.lastCompletedLap).toMatchObject({ lapNum: 1 });
  });

  it('updateLapLog replaces previous history on each call', () => {
    runInAction(() =>
      store.updateLapLog(
        makeFrame([{ lapNum: 1, lapTime: 90.0, delta: null, isBest: true }])
      )
    );

    runInAction(() =>
      store.updateLapLog(
        makeFrame([
          { lapNum: 2, lapTime: 92.0, delta: 2.0, isBest: false },
          { lapNum: 1, lapTime: 90.0, delta: null, isBest: true },
        ])
      )
    );

    expect(store.lapHistory).toHaveLength(2);
    expect(store.lapHistory[0].lapNum).toBe(2);
  });

  it('reset clears history and lastCompletedLap', () => {
    runInAction(() =>
      store.updateLapLog(
        makeFrame([{ lapNum: 1, lapTime: 90.0, delta: null, isBest: true }], {
          lapNum: 1,
          delta: null,
        })
      )
    );

    runInAction(() => store.reset());

    expect(store.lapHistory).toHaveLength(0);
    expect(store.lastCompletedLap).toBeNull();
  });

  it('null lastCompletedLap in frame is stored as null', () => {
    runInAction(() => store.updateLapLog(makeFrame([], null)));

    expect(store.lastCompletedLap).toBeNull();
  });
});

const makeEntries = (carCount: number): DriverEntriesFrame => ({
  entries: Array.from(
    { length: carCount },
    (_unused, carIdx) => ({ carIdx }) as unknown as DriverEntry
  ),
  playerCarIdx: 0,
});

const makeRoster = (carClassIds: number[]): SessionSnapshot =>
  ({
    cars: carClassIds.map(
      (carClassId, carIdx) => ({ carIdx, carClassId }) as unknown as CarEntry
    ),
  }) as unknown as SessionSnapshot;

describe('BackendComputedStore carClassCount', () => {
  let session: SessionStore;
  let store: BackendComputedStore;

  const seedField = (carClassIds: number[]) => {
    session.updateSessionInfo(makeRoster(carClassIds));
    store.updateDriverEntries(makeEntries(carClassIds.length));
  };

  beforeEach(() => {
    session = new SessionStore();
    store = new BackendComputedStore(session);
  });

  it('starts at zero with no field', () => {
    expect(store.carClassCount).toBe(0);
  });

  it('counts distinct classes from driverEntries', () => {
    runInAction(() => seedField([1, 1, 2, 3, 3]));

    expect(store.carClassCount).toBe(3);
  });

  it('reset drops driverEntries and the count back to zero', () => {
    runInAction(() => seedField([1, 2]));

    runInAction(() => store.reset());

    expect(store.driverEntries).toBeNull();
    expect(store.carClassCount).toBe(0);
  });
});
