import { describe, it, expect, beforeEach } from 'vitest';
import { runInAction } from 'mobx';
import { BackendComputedStore } from './computed.store';
import type { LapLogFrame } from '@/types/bindings';

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
    store = new BackendComputedStore();
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
