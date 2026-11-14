import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AutologState,
  CategoryRating,
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
  trackName: 'Fuji Speedway',
  trackConfig: null,
  carName: 'Mercedes-AMG GT3 2020',
  finishPos: 14,
  fieldSize: 48,
  bestLapS: 101.192,
  incidents: 3,
};

const WEEK = { sessions: 0, races: 0, laps: 0, incidents: 0 };

const EMPTY_HOME: HomeStats = {
  ratings: [],
  week: WEEK,
  previousWeek: WEEK,
  driven: [],
  topCars: [],
  topTracks: [],
  lastRace: null,
};

const rating = (category: string): CategoryRating => ({
  category,
  licence: 'B 3.74',
  irating: 2000,
  weekChange: 0,
  lastSessionAt: SESSION.startedAt,
  history: [
    { key: 'sub:1', startedAt: 1, irating: 1900, trackName: null },
    { key: 'sub:2', startedAt: 2, irating: 2000, trackName: null },
  ],
});

const api = vi.hoisted(() => ({
  status: null as unknown as StatsImportStatus,
  sessions: [] as RecentSession[],
  home: null as unknown as HomeStats,
  autolog: 'on' as AutologState,
  enableAutolog: vi.fn(async (): Promise<AutologState> => 'on'),
  onStatus: null as ((status: StatsImportStatus) => void) | null,
  unlisten: vi.fn(),
  folder: {
    path: 'D:/Documents/iRacing/telemetry',
    isDefault: true,
  } as StatsFolder,
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
  getStatsFolder: vi.fn(async () => api.folder),
  setStatsFolder: api.setStatsFolder,
  reimportStats: api.reimportStats,
  getSkippedFiles: vi.fn(async () => api.skipped),
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

describe('StatisticsStore iRating chart', () => {
  beforeEach(() => {
    api.status = IDLE;
    api.sessions = [SESSION];
    api.home = {
      ...EMPTY_HOME,
      ratings: [rating('Sports Car'), rating('Oval')],
    };
  });

  it('shows the latest session’s category until another is picked', async () => {
    const store = new StatisticsStore();
    await store.start();

    expect(store.chartRating?.category).toBe('Sports Car');

    store.selectChartCategory('Oval');

    expect(store.chartRating?.category).toBe('Oval');
  });

  it('falls back to the latest category when the picked one is gone', async () => {
    const store = new StatisticsStore();
    store.selectChartCategory('Dirt Oval');
    await store.start();

    expect(store.chartRating?.category).toBe('Sports Car');
  });

  it('charts the whole history of the category on All', async () => {
    const store = new StatisticsStore();
    await store.start();

    store.setIratingRange('all');

    expect(store.iratingSteps.map((step) => step.change)).toEqual([null, 100]);
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
    api.home = {
      ...EMPTY_HOME,
      lastRace: { session: SESSION, iratingChange: 38 },
    };
    const store = new StatisticsStore();
    await store.start();

    expect(store.lastRace).toEqual({ session: SESSION, iratingChange: 38 });
  });

  it('reads whether the game logs telemetry on start', async () => {
    const store = new StatisticsStore();
    await store.start();

    expect(store.autolog).toBe('off');
  });

  it('reads it again once a pass ends: the game may have changed it', async () => {
    const store = new StatisticsStore();
    await store.start();

    api.autolog = 'on';
    api.onStatus?.({ phase: 'reading', done: 0, total: 1, broken: 0 });
    api.onStatus?.(IDLE);
    await flush();

    expect(store.autolog).toBe('on');
  });

  it('turns logging on and keeps what the file says after', async () => {
    api.enableAutolog.mockResolvedValue('on');
    const store = new StatisticsStore();
    await store.start();

    await store.enableAutolog();

    expect(store.autolog).toBe('on');
    expect(store.autologError).toBeNull();
  });

  it('keeps the state and the reason when the file is not written', async () => {
    api.enableAutolog.mockRejectedValue('Close iRacing first');
    const store = new StatisticsStore();
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

  it('loads the folder and the skipped files on start', async () => {
    api.skipped = [SKIPPED];
    const store = new StatisticsStore();

    await store.start();

    expect(store.folder).toEqual(api.folder);
    expect(store.skippedFiles).toEqual([SKIPPED]);
  });

  it('keeps the folder picked, and leaves it when the picker is closed', async () => {
    const store = new StatisticsStore();
    await store.start();

    await store.chooseFolder();
    expect(api.setStatsFolder).not.toHaveBeenCalled();

    api.pickedFolder = 'E:/ibt';
    await store.chooseFolder();

    expect(api.setStatsFolder).toHaveBeenCalledWith('E:/ibt');
    expect(store.folder).toEqual({ path: 'E:/ibt', isDefault: false });

    await store.useDefaultFolder();

    expect(api.setStatsFolder).toHaveBeenLastCalledWith(null);
    expect(store.folder?.isDefault).toBe(true);
  });

  it('reloads the skipped files when the count of them changes', async () => {
    const store = new StatisticsStore();
    await store.start();

    api.skipped = [SKIPPED];
    api.onStatus?.({ phase: 'reading', done: 0, total: 3, broken: 1 });
    await flush();

    expect(store.skippedFiles).toEqual([SKIPPED]);
  });

  it('asks for a full pass on re-import', async () => {
    const store = new StatisticsStore();

    await store.reimport();

    expect(api.reimportStats).toHaveBeenCalledOnce();
  });

  it('exports to the file picked and answers how many sessions', async () => {
    const store = new StatisticsStore();

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
