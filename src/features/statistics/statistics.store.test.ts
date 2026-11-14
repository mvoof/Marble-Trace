import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  RecentSession,
  StatsImportStatus,
} from '@shared/contracts/generated/bindings';

const IDLE: StatsImportStatus = { phase: 'idle', done: 0, total: 0, broken: 0 };

const SESSION: RecentSession = {
  key: 'sub:77',
  startedAt: 1_762_449_323,
  eventType: 'Race',
  trackName: 'Fuji Speedway',
  trackConfig: null,
  carName: 'Mercedes-AMG GT3 2020',
  finishPos: 14,
  fieldSize: 48,
  bestLapS: 101.192,
  incidents: 3,
};

const api = vi.hoisted(() => ({
  status: null as unknown as StatsImportStatus,
  sessions: [] as RecentSession[],
  onStatus: null as ((status: StatsImportStatus) => void) | null,
  unlisten: vi.fn(),
}));

vi.mock('@shared/api/stats.service', () => ({
  getStatsImportStatus: vi.fn(async () => api.status),
  getRecentSessions: vi.fn(async () => api.sessions),
  listenStatsImport: vi.fn(
    async (onStatus: (status: StatsImportStatus) => void) => {
      api.onStatus = onStatus;

      return api.unlisten;
    }
  ),
}));

const { StatisticsStore } = await import('./statistics.store');

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('StatisticsStore', () => {
  beforeEach(() => {
    api.status = IDLE;
    api.sessions = [];
    api.onStatus = null;
    api.unlisten.mockClear();
  });

  it('loads the import status and the recent sessions on start', async () => {
    api.status = { phase: 'reading', done: 2, total: 9, broken: 0 };
    api.sessions = [SESSION];
    const store = new StatisticsStore();

    await store.start();

    expect(store.importStatus).toEqual(api.status);
    expect(store.recentSessions).toEqual([SESSION]);
    expect(store.loaded).toBe(true);
  });

  it('follows the import and picks up the sessions each file adds', async () => {
    const store = new StatisticsStore();
    await store.start();

    api.sessions = [SESSION];
    api.onStatus?.({ phase: 'reading', done: 1, total: 3, broken: 0 });
    await flush();

    expect(store.importStatus.done).toBe(1);
    expect(store.recentSessions).toEqual([SESSION]);
  });

  it('a pause alone does not reload the sessions', async () => {
    const store = new StatisticsStore();
    await store.start();

    api.sessions = [SESSION];
    api.onStatus?.({ phase: 'paused', done: 0, total: 3, broken: 0 });
    await flush();

    expect(store.importStatus.phase).toBe('paused');
    expect(store.recentSessions).toEqual([]);
  });

  it('stops listening on dispose', async () => {
    const store = new StatisticsStore();
    await store.start();

    store.dispose();

    expect(api.unlisten).toHaveBeenCalledOnce();
  });
});
