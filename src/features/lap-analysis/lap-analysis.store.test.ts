import { describe, expect, it, vi } from 'vitest';

import type {
  AnalysisSet,
  LapRef,
  RecentSession,
  SessionLap,
} from '@shared/contracts/generated/bindings';
import {
  LapAnalysisStore,
  isAnalysable,
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
  ...extra,
});

const emptySet: AnalysisSet = { session: null, laps: [] };

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
  setAnalysisLapColor: vi.fn(async () => emptySet),
  setAnalysisLapVisible: vi.fn(async () => emptySet),
  setAnalysisReference: vi.fn(async () => emptySet),
});

describe('isAnalysable', () => {
  it('takes timed full laps off pit road whose file is on disk', () => {
    expect(
      [
        sessionLap(1),
        sessionLap(2, { partial: true }),
        sessionLap(3, { inPit: true }),
        sessionLap(4, { timeS: null }),
        sessionLap(5, { filePresent: false }),
      ].map(isAnalysable)
    ).toEqual([true, false, false, false, false]);
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
});
