import { describe, expect, it, vi } from 'vitest';

import type {
  AnalysisSet,
  CarSetupView,
  LapRef,
  RecentSession,
  SessionLap,
} from '@shared/contracts/generated/bindings';
import {
  LapAnalysisStore,
  holdsTelemetry,
  isAnalysable,
  MAP_CHANNELS,
  type LapAnalysisApi,
} from './lap-analysis.store';

const SESSION: RecentSession = {
  key: 'sub:1',
  startedAt: 1,
  eventType: 'Race',
  kind: 'race',
  hasAi: false,
  laps: 3,
  trackName: 'Spa',
  trackConfig: null,
  carName: 'BMW',
  finishPos: null,
  fieldSize: null,
  bestLapS: 100,
  incidents: 0,
};

const ref = (lapNum: number): LapRef => ({
  path: 'a.ibt',
  sessionNum: 2,
  lapNum,
});

const sessionLap = (
  lapNum: number,
  extra: Partial<SessionLap> = {}
): SessionLap => ({
  lap: ref(lapNum),
  runType: 'Race',
  timeS: 100,
  deltaS: 0,
  incidents: 0,
  inPit: false,
  partial: false,
  isBest: false,
  filePresent: true,
  stored: false,
  ...extra,
});

const emptySet: AnalysisSet = { session: null, laps: [], sectors: [] };

const fakeApi = (): LapAnalysisApi => ({
  getSessionLaps: vi.fn(async () => ({
    session: SESSION,
    laps: [
      sessionLap(1, { partial: true }),
      sessionLap(2),
      sessionLap(3, { inPit: true }),
      sessionLap(4, { filePresent: false }),
      sessionLap(5),
    ],
  })),
  getAnalysisSet: vi.fn(async () => emptySet),
  addAnalysisLaps: vi.fn(async () => emptySet),
  removeAnalysisLap: vi.fn(async () => emptySet),
  deleteSession: vi.fn(async () => emptySet),
  setAnalysisLapColor: vi.fn(async () => emptySet),
  setAnalysisLapVisible: vi.fn(async () => emptySet),
  setAnalysisReference: vi.fn(async () => emptySet),
  loadAnalysisLaps: vi.fn(async () => ({
    points: 4485,
    channels: [],
    missing: [],
  })),
  unloadAnalysis: vi.fn(async () => undefined),
  getCarSetup: vi.fn(async () => ({ state: 'fileDeleted' as const })),
  getLapChannels: vi.fn(async (laps: LapRef[], channels: string[]) => ({
    points: 3,
    values: laps.map((lap) =>
      channels.map(() => new Float32Array([0, lap.lapNum, lap.lapNum * 2]))
    ),
  })),
});

describe('isAnalysable', () => {
  it('takes timed full laps off pit road the database or the file holds', () => {
    expect(
      [
        sessionLap(1),
        sessionLap(2, { partial: true }),
        sessionLap(3, { inPit: true }),
        sessionLap(4, { timeS: null }),
        sessionLap(5, { filePresent: false }),
        sessionLap(6, { filePresent: false, stored: true }),
      ].map(isAnalysable)
    ).toEqual([true, false, false, false, false, true]);
  });
});

describe('LapAnalysisStore', () => {
  it('adds every analysable lap of the open session', async () => {
    const api = fakeApi();
    const store = new LapAnalysisStore(api);

    await store.openSession('sub:1');
    await store.addAllLaps();

    expect(api.addAnalysisLaps).toHaveBeenCalledWith('sub:1', [ref(2), ref(5)]);
  });

  it('adds nothing with the modal closed', async () => {
    const api = fakeApi();
    const store = new LapAnalysisStore(api);

    await store.addLaps([ref(2)]);

    expect(api.addAnalysisLaps).not.toHaveBeenCalled();
  });

  it('drops the laps of a session closed before they arrived', async () => {
    const api = fakeApi();
    const store = new LapAnalysisStore(api);

    const opening = store.openSession('sub:1');
    store.closeSession();
    await opening;

    expect(store.modalLaps).toBeNull();
  });

  it('deletes the open session, takes the set without it and closes', async () => {
    const api = fakeApi();
    const store = new LapAnalysisStore(api);
    await store.openSession('sub:1');

    const deleted = await store.deleteSession(true);

    expect(deleted).toBe(true);
    expect(api.deleteSession).toHaveBeenCalledWith('sub:1', true);
    expect(store.set).toEqual(emptySet);
    expect(store.modalKey).toBeNull();
  });

  it('keeps the modal open when the delete fails', async () => {
    const api = fakeApi();
    api.deleteSession = vi.fn(async () => {
      throw new Error('locked');
    });
    const store = new LapAnalysisStore(api);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await store.openSession('sub:1');

    const deleted = await store.deleteSession(false);

    expect(deleted).toBe(false);
    expect(store.modalKey).toBe('sub:1');
  });
});

describe('holdsTelemetry', () => {
  it('drops only while the game runs, the window is away and the setting is off', () => {
    const gate = {
      simConnected: true,
      windowFocused: false,
      keepWhileGameRuns: false,
    };

    expect(holdsTelemetry(gate)).toBe(false);
    expect(holdsTelemetry({ ...gate, simConnected: false })).toBe(true);
    expect(holdsTelemetry({ ...gate, windowFocused: true })).toBe(true);
    expect(holdsTelemetry({ ...gate, keepWhileGameRuns: true })).toBe(true);
  });
});

describe('LapAnalysisStore telemetry', () => {
  const setWithLap: AnalysisSet = {
    session: SESSION,
    sectors: [],
    laps: [
      {
        lap: ref(2),
        runType: 'Race',
        timeS: 100,
        isBest: true,
        color: '#4cc9f0',
        visible: true,
        reference: true,
        filePresent: true,
        stored: false,
      },
    ],
  };

  const storeWithLap = async (api: LapAnalysisApi) => {
    vi.mocked(api.getAnalysisSet).mockResolvedValue(setWithLap);
    const store = new LapAnalysisStore(api);
    await store.load();

    return store;
  };

  it('loads the set, drops it on blur while the game runs, loads it again on focus', async () => {
    const api = fakeApi();
    const store = await storeWithLap(api);

    await store.syncTelemetry();
    expect(store.telemetry).toBe('ready');
    expect(api.loadAnalysisLaps).toHaveBeenCalledWith([ref(2)]);

    store.setGate({
      simConnected: true,
      windowFocused: false,
      keepWhileGameRuns: false,
    });
    await store.syncTelemetry();
    expect(store.telemetry).toBe('unloaded');
    expect(api.unloadAnalysis).toHaveBeenCalledOnce();

    store.setGate({
      simConnected: true,
      windowFocused: true,
      keepWhileGameRuns: false,
    });
    await store.syncTelemetry();
    expect(store.telemetry).toBe('ready');
    expect(api.loadAnalysisLaps).toHaveBeenCalledTimes(2);
  });

  it('is idle with no laps', async () => {
    const api = fakeApi();
    const store = new LapAnalysisStore(api);

    await store.syncTelemetry();

    expect(store.telemetry).toBe('idle');
    expect(api.loadAnalysisLaps).not.toHaveBeenCalled();
  });

  it('keeps a load from settling once an unload came after it', async () => {
    const api = fakeApi();
    let finishLoad: () => void = () => {};
    vi.mocked(api.loadAnalysisLaps).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLoad = () => resolve({ points: 1, channels: [], missing: [] });
        })
    );
    const store = await storeWithLap(api);

    const loading = store.syncTelemetry();
    store.setGate({
      simConnected: true,
      windowFocused: false,
      keepWhileGameRuns: false,
    });
    await store.syncTelemetry();
    finishLoad();
    await loading;

    expect(store.telemetry).toBe('unloaded');
  });
});

describe('LapAnalysisStore charts', () => {
  it('counts the delta from each lap’s time minus the reference’s', async () => {
    const api = fakeApi();
    const lapIn = (lapNum: number, reference: boolean) => ({
      lap: ref(lapNum),
      runType: 'Race',
      timeS: 100,
      isBest: false,
      color: '#4cc9f0',
      visible: true,
      reference,
      filePresent: true,
      stored: false,
    });
    vi.mocked(api.getAnalysisSet).mockResolvedValue({
      session: SESSION,
      laps: [lapIn(2, false), lapIn(3, true)],
      sectors: [],
    });
    const store = new LapAnalysisStore(api);
    await store.load();
    await store.syncTelemetry();

    await store.fetchCharts(['deltaToReference', 'Speed']);

    expect(api.getLapChannels).toHaveBeenLastCalledWith(
      [ref(2), ref(3)],
      ['Speed', 'ElapsedTime', ...MAP_CHANNELS]
    );
    expect(
      store.chartValues('deltaToReference')?.map((lap) => Array.from(lap))
    ).toEqual([
      [0, -1, -2],
      [0, 0, 0],
    ]);
    expect(Array.from(store.chartValues('Speed')?.[1] ?? [])).toEqual([
      0, 3, 6,
    ]);
  });
});

describe('LapAnalysisStore setup', () => {
  const setOf = (
    laps: { path: string; reference: boolean }[]
  ): AnalysisSet => ({
    session: SESSION,
    laps: laps.map(({ path, reference }, index) => ({
      lap: { path, sessionNum: 0, lapNum: index + 1 },
      runType: 'Practice',
      timeS: 100,
      isBest: false,
      color: '#4cc9f0',
      visible: true,
      reference,
      filePresent: true,
      stored: false,
    })),
    sectors: [],
  });
  const SETUP: CarSetupView = {
    state: 'setup',
    name: 'race.sto',
    groups: [
      {
        name: 'Chassis',
        sections: [
          { name: 'Front', rows: [{ label: 'ArbBlades', value: '3' }] },
        ],
      },
    ],
  };

  it('reads the setup of the reference lap’s file', async () => {
    const api = fakeApi();
    api.getCarSetup = vi.fn(async () => SETUP);
    vi.mocked(api.getAnalysisSet).mockResolvedValue(
      setOf([
        { path: 'first.ibt', reference: false },
        { path: 'second.ibt', reference: true },
      ])
    );
    const store = new LapAnalysisStore(api);
    await store.load();

    await store.fetchSetup();

    expect(api.getCarSetup).toHaveBeenCalledWith('second.ibt');
    expect(store.setup).toEqual(SETUP);
  });

  it('keeps the answer for the file asked for last', async () => {
    const api = fakeApi();
    let answerFirst: (view: CarSetupView) => void = () => undefined;
    api.getCarSetup = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<CarSetupView>((resolve) => {
            answerFirst = resolve;
          })
      )
      .mockResolvedValueOnce({ state: 'fileDeleted' });
    vi.mocked(api.getAnalysisSet)
      .mockResolvedValueOnce(setOf([{ path: 'old.ibt', reference: true }]))
      .mockResolvedValueOnce(setOf([{ path: 'new.ibt', reference: true }]));
    const store = new LapAnalysisStore(api);
    await store.load();
    const stale = store.fetchSetup();
    await store.load();

    await store.fetchSetup();
    answerFirst(SETUP);
    await stale;

    expect(store.setup).toEqual({ state: 'fileDeleted' });
  });

  it('says so when the file cannot be read', async () => {
    const api = fakeApi();
    api.getCarSetup = vi.fn(async () => {
      throw new Error('broken header');
    });
    vi.mocked(api.getAnalysisSet).mockResolvedValue(
      setOf([{ path: 'broken.ibt', reference: true }])
    );
    const store = new LapAnalysisStore(api);
    await store.load();

    await store.fetchSetup();

    expect(store.setup).toEqual({ state: 'unreadable' });
  });

  it('has no setup without laps', async () => {
    const api = fakeApi();
    api.getCarSetup = vi.fn(async () => SETUP);
    const store = new LapAnalysisStore(api);

    await store.fetchSetup();

    expect(api.getCarSetup).not.toHaveBeenCalled();
    expect(store.setup).toBeNull();
  });
});
