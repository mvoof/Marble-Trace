import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observable, runInAction } from 'mobx';

import type { DriverEntry } from '@/types/bindings';
import { WheelToWheelWidgetStore } from './wheel-to-wheel.widget';

type Deps = ConstructorParameters<typeof WheelToWheelWidgetStore>[0];

const LAP_TIME_S = 100;
const HIDE_DELAY_S = 3;

const carAt = (
  carIdx: number,
  gapSeconds: number,
  isPlayer = false
): DriverEntry =>
  ({
    carIdx,
    carClassId: 1,
    isPlayer,
    onPitRoad: false,
    trackSurface: 'OnTrack',
    lap: 5,
    lapDistPct: 0.5 + gapSeconds / LAP_TIME_S,
    relativeLapDist: gapSeconds / LAP_TIME_S,
    estTime: 50 + gapSeconds,
    classEstLapTime: LAP_TIME_S,
    bestLapTime: LAP_TIME_S,
    speed: 0,
  }) as DriverEntry;

const makeStore = () => {
  const backendComputed = observable({
    relativeEntries: [carAt(0, 0, true), carAt(1, -0.3)],
  });
  const appSettings = observable({ dragMode: false });
  const store = new WheelToWheelWidgetStore({
    backendComputed,
    appSettings,
    liveWidgets: {
      getSettings: () => ({
        gapThreshold: 1,
        hideDelay: HIDE_DELAY_S,
        raceOnly: true,
        includeLapped: false,
      }),
    },
    session: { currentSessionType: 'Race', sessionInfo: null },
    units: { unitSystem: 'metric' },
  } as unknown as Deps);

  store.init();

  const moveRivalTo = (gapSeconds: number) =>
    runInAction(() => {
      backendComputed.relativeEntries = [
        carAt(0, 0, true),
        carAt(1, gapSeconds),
      ];
    });

  const placeRivals = (...gaps: number[]) =>
    runInAction(() => {
      backendComputed.relativeEntries = [
        carAt(0, 0, true),
        ...gaps.map((gapSeconds, index) => carAt(index + 1, gapSeconds)),
      ];
    });

  return { store, appSettings, moveRivalTo, placeRivals };
};

describe('WheelToWheelWidgetStore visibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows while a rival is inside the threshold', () => {
    const { store } = makeStore();

    expect(store.isVisible).toBe(true);
  });

  it('hides once nobody is near and the fade-out delay has passed', () => {
    const { store, moveRivalTo } = makeStore();

    moveRivalTo(-5);

    expect(store.isVisible).toBe(true);

    vi.advanceTimersByTime(HIDE_DELAY_S * 1000);

    expect(store.isVisible).toBe(false);
  });

  it('stays when the rival comes back before the delay runs out', () => {
    const { store, moveRivalTo } = makeStore();

    moveRivalTo(-5);
    vi.advanceTimersByTime(1000);
    moveRivalTo(-0.4);
    vi.advanceTimersByTime(HIDE_DELAY_S * 1000);

    expect(store.isVisible).toBe(true);
  });

  it('is hidden from the start when nobody is near', () => {
    const { store, moveRivalTo } = makeStore();

    moveRivalTo(-5);
    vi.advanceTimersByTime(HIDE_DELAY_S * 1000);
    store.dispose();

    const fresh = makeStore();
    fresh.moveRivalTo(-5);
    vi.advanceTimersByTime(HIDE_DELAY_S * 1000);

    expect(fresh.store.isVisible).toBe(false);
  });

  it('is always drawn in drag mode, so it can be placed', () => {
    const { store, appSettings, moveRivalTo } = makeStore();

    moveRivalTo(-5);
    vi.advanceTimersByTime(HIDE_DELAY_S * 1000);
    runInAction(() => {
      appSettings.dragMode = true;
    });

    expect(store.isVisible).toBe(true);
  });

  it('splits the rival half when there is a car on each side', () => {
    const { store, placeRivals } = makeStore();

    placeRivals(0.4, -0.3);

    expect(store.isSplit).toBe(true);
    expect(store.shownAheadEntry?.carIdx).toBe(1);
    expect(store.shownBehindEntry?.carIdx).toBe(2);
  });

  it('empties one side at once while the other keeps its rival', () => {
    const { store, placeRivals } = makeStore();

    placeRivals(0.4, -0.3);
    placeRivals(5, -0.3);

    expect(store.isSplit).toBe(false);
    expect(store.singleSlot).toBe('behind');
  });
});
