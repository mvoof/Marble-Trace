import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AutologState,
  HomeStats,
  RecentSession,
  SkippedFile,
  StatsFolder,
  StatsImportStatus,
} from '@shared/contracts/generated/bindings';

const IDLE: StatsImportStatus = { phase: 'idle', done: 0, total: 0, broken: 0 };

const SESSION: RecentSession = {
  key: 'sub:77',
  startedAt: 1_762_449_323,
  eventType: 'Race',
  kind: 'race',
  hasAi: false,
  laps: 12,
  trackName: 'Fuji Speedway',
  trackConfig: null,
  carName: 'Mercedes-AMG GT3 2020',
  finishPos: 14,
  fieldSize: 48,
  bestLapS: 101.192,
  incidents: 3,
};

const WEEK = {
  timeInCarS: 0,
  km: 0,
  fullLaps: 0,
  cleanLaps: 0,
  races: 0,
  wins: 0,
  podiums: 0,
  topTens: 0,
  personalBests: [],
};

const EMPTY_HOME: HomeStats = {
  week: WEEK,
  previousWeek: WEEK,
  driven: [],
  topCars: [],
  topTracks: [],
  lastRace: null,
};

const api = vi.hoisted(() => ({
  status: null as unknown as StatsImportStatus,
  sessions: [] as RecentSession[],
  home: null as unknown as HomeStats,
  autolog: 'on' as AutologState,
  enableAutolog: vi.fn(async (): Promise<AutologState> => 'on'),
  onStatus: null as ((status: StatsImportStatus) => void) | null,
  unlisten: vi.fn(),
  skipped: [] as SkippedFile[],
  pickedFolder: null as string | null,
  csvTarget: null as string | null,
  setStatsFolder: vi.fn(async (path: string | null): Promise<StatsFolder> => ({
    path: path ?? 'D:/Documents/iRacing/telemetry',
    isDefault: path === null,
  })),
  reimportStats: vi.fn(async () => undefined),
  exportSessionsCsv: vi.fn(async () => 12),
}));

vi.mock('@shared/api/stats.service', () => ({
  getStatsImportStatus: vi.fn(async () => api.status),
  getRecentSessions: vi.fn(async () => api.sessions),
  getHomeStats: vi.fn(async () => api.home),
  getAutologState: vi.fn(async () => api.autolog),
  enableAutolog: api.enableAutolog,
  setStatsFolder: api.setStatsFolder,
  reimportStats: api.reimportStats,
  getSkippedFiles: vi.fn(async () => api.skipped),
  getKnownCars: vi.fn(async () => []),
  getSessionsPage: vi.fn(async () => ({
    rows: [],
    total: 0,
    page: 0,
    pageSize: 20,
  })),
  exportSessionsCsv: api.exportSessionsCsv,
  pickStatsFolder: vi.fn(async () => api.pickedFolder),
  pickSessionsCsvTarget: vi.fn(async () => api.csvTarget),
  listenStatsImport: vi.fn(
    async (onStatus: (status: StatsImportStatus) => void) => {
      api.onStatus = onStatus;

      return api.unlisten;
    }
  ),
}));

const { StatisticsStore } = await import('./statistics.store');

const deps = () => ({ appSettings: { update: vi.fn() } });

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('StatisticsStore', () => {
  beforeEach(() => {
    api.status = IDLE;
    api.home = EMPTY_HOME;
    api.sessions = [];
    api.onStatus = null;
    api.autolog = 'on';
    api.enableAutolog.mockReset();
    api.unlisten.mockClear();
  });

  it('loads the import status and the recent sessions on start', async () => {
    api.status = { phase: 'reading', done: 2, total: 9, broken: 0 };
    api.sessions = [SESSION];
    const store = new StatisticsStore(deps());

    await store.start();

    expect(store.importStatus).toEqual(api.status);
    expect(store.recentSessions).toEqual([SESSION]);
    expect(store.loaded).toBe(true);
  });

  it('follows the import and picks up the sessions each file adds', async () => {
    const store = new StatisticsStore(deps());
    await store.start();

    api.sessions = [SESSION];
    api.onStatus?.({ phase: 'reading', done: 1, total: 3, broken: 0 });
    await flush();

    expect(store.importStatus.done).toBe(1);
    expect(store.recentSessions).toEqual([SESSION]);
  });

  it('a pause alone does not reload the sessions', async () => {
    const store = new StatisticsStore(deps());
    await store.start();

    api.sessions = [SESSION];
    api.onStatus?.({ phase: 'paused', done: 0, total: 3, broken: 0 });
    await flush();

    expect(store.importStatus.phase).toBe('paused');
    expect(store.recentSessions).toEqual([]);
  });

  it('stops listening on dispose', async () => {
    const store = new StatisticsStore(deps());
    await store.start();

    store.dispose();

    expect(api.unlisten).toHaveBeenCalledOnce();
  });
});

describe('StatisticsStore last race and autolog', () => {
  beforeEach(() => {
    api.status = IDLE;
    api.sessions = [SESSION];
    api.home = EMPTY_HOME;
    api.autolog = 'off';
    api.enableAutolog.mockReset();
  });

  it('serves the last race the home stats hold', async () => {
    const lastRace = {
      session: SESSION,
      trackId: 262,
      trackCountry: 'Germany',
      outline: { svgPath: 'M 0 0 L 1 1 Z', viewBox: '0 0 1 1' },
    };
    api.home = { ...EMPTY_HOME, lastRace };
    const store = new StatisticsStore(deps());
    await store.start();

    expect(store.lastRace).toEqual(lastRace);
  });

  it('reads whether the game logs telemetry on start', async () => {
    const store = new StatisticsStore(deps());
    await store.start();

    expect(store.autolog).toBe('off');
  });

  it('reads it again once a pass ends: the game may have changed it', async () => {
    const store = new StatisticsStore(deps());
    await store.start();

    api.autolog = 'on';
    api.onStatus?.({ phase: 'reading', done: 0, total: 1, broken: 0 });
    api.onStatus?.(IDLE);
    await flush();

    expect(store.autolog).toBe('on');
  });

  it('turns logging on and keeps what the file says after', async () => {
    api.enableAutolog.mockResolvedValue('on');
    const store = new StatisticsStore(deps());
    await store.start();

    await store.enableAutolog();

    expect(store.autolog).toBe('on');
    expect(store.autologError).toBeNull();
  });

  it('keeps the state and the reason when the file is not written', async () => {
    api.enableAutolog.mockRejectedValue('Close iRacing first');
    const store = new StatisticsStore(deps());
    await store.start();

    await store.enableAutolog();

    expect(store.autolog).toBe('off');
    expect(store.autologError).toBe('Close iRacing first');
    expect(store.enablingAutolog).toBe(false);
  });
});

describe('StatisticsStore data section', () => {
  const SKIPPED: SkippedFile = {
    path: 'D:/Documents/iRacing/telemetry/cut.ibt',
    error: 'file ends mid-sample',
    readAt: 5,
  };

  beforeEach(() => {
    api.status = IDLE;
    api.sessions = [];
    api.home = EMPTY_HOME;
    api.skipped = [];
    api.pickedFolder = null;
    api.csvTarget = null;
    api.setStatsFolder.mockClear();
    api.reimportStats.mockClear();
    api.exportSessionsCsv.mockClear();
  });

  it('loads the skipped files on start, and no folder before main sends one', async () => {
    api.skipped = [SKIPPED];
    const store = new StatisticsStore(deps());

    await store.start();

    expect(store.folder).toBeNull();
    expect(store.skippedFiles).toEqual([SKIPPED]);
  });

  it('writes the folder picked into the settings, nothing when the picker is closed', async () => {
    const storeDeps = deps();
    const store = new StatisticsStore(storeDeps);
    await store.start();

    await store.chooseFolder();
    expect(storeDeps.appSettings.update).not.toHaveBeenCalled();

    api.pickedFolder = 'E:/ibt';
    await store.chooseFolder();

    expect(storeDeps.appSettings.update).toHaveBeenCalledWith({
      statsFolder: 'E:/ibt',
    });

    store.useDefaultFolder();

    expect(storeDeps.appSettings.update).toHaveBeenLastCalledWith({
      statsFolder: null,
    });
    expect(api.setStatsFolder).not.toHaveBeenCalled();
  });

  it('reloads the skipped files when the count of them changes', async () => {
    const store = new StatisticsStore(deps());
    await store.start();

    api.skipped = [SKIPPED];
    api.onStatus?.({ phase: 'reading', done: 0, total: 3, broken: 1 });
    await flush();

    expect(store.skippedFiles).toEqual([SKIPPED]);
  });

  it('asks for a full pass on re-import', async () => {
    const store = new StatisticsStore(deps());

    await store.reimport();

    expect(api.reimportStats).toHaveBeenCalledOnce();
  });

  it('exports to the file picked and answers how many sessions', async () => {
    const store = new StatisticsStore(deps());

    expect(await store.exportCsv()).toBeNull();
    expect(api.exportSessionsCsv).not.toHaveBeenCalled();

    api.csvTarget = 'C:/out/sessions.csv';

    expect(await store.exportCsv()).toEqual({
      path: 'C:/out/sessions.csv',
      count: 12,
    });
    expect(api.exportSessionsCsv).toHaveBeenCalledWith('C:/out/sessions.csv');
  });
});
