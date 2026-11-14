import { makeAutoObservable, runInAction } from 'mobx';

import { fileStamp } from '@shared/api/file-export.service';
import {
  enableAutolog,
  exportSessionsCsv,
  getAutologState,
  getHomeStats,
  getKnownCars,
  getRecentSessions,
  getSkippedFiles,
  getStatsFolder,
  getStatsImportStatus,
  listenStatsImport,
  pickSessionsCsvTarget,
  pickStatsFolder,
  reimportStats,
  setStatsFolder,
} from '@shared/api/stats.service';
import type {
  AutologState,
  CategoryRating,
  HomeStats,
  KnownCar,
  LastRace,
  RecentSession,
  SkippedFile,
  StatsFolder,
  StatsImportStatus,
  TimeDriven,
} from '@shared/contracts/generated/bindings';
import { drivenWeeks, type DrivenDay } from './days-driven';
import { iratingSteps, type IratingRange } from './home-stats';

/** Rows of the recent sessions table on Home. */
const RECENT_SESSIONS_LIMIT = 10;
const MS_PER_SECOND = 1000;

/** A CSV export written: where, and how many sessions it holds. */
export interface CsvExport {
  path: string;
  count: number;
}

const INITIAL_STATUS: StatsImportStatus = {
  phase: 'idle',
  done: 0,
  total: 0,
  broken: 0,
};

/**
 * The driver's statistics as the main window shows them: what the stats
 * import is doing, and the sessions it has recorded. The backend reads the
 * files; this store follows it and reloads what a finished file changed.
 */
export class StatisticsStore {
  importStatus: StatsImportStatus = INITIAL_STATUS;
  recentSessions: RecentSession[] = [];
  homeStats: HomeStats | null = null;
  /** When `homeStats` was counted, unix seconds: the chart's ranges end there. */
  homeStatsAtS = 0;
  /** The category the iRating chart shows; `null` follows the latest session. */
  chartCategory: string | null = null;
  iratingRange: IratingRange = '90d';
  /** The first load has answered, so an empty list means no sessions. */
  loaded = false;
  /** Whether the game writes the files statistics read; `null` until asked. */
  autolog: AutologState | null = null;
  enablingAutolog = false;
  /** Why turning logging on failed, as the backend said it. */
  autologError: string | null = null;
  /** Where the import reads from; `null` until asked. */
  folder: StatsFolder | null = null;
  /** The files the import could not read, the latest tried first. */
  skippedFiles: SkippedFile[] = [];
  /** The cars of the session records, by name. */
  knownCars: KnownCar[] = [];

  private unlisten: (() => void) | null = null;
  private disposed = false;

  constructor() {
    makeAutoObservable<StatisticsStore, 'unlisten' | 'disposed'>(this, {
      unlisten: false,
      disposed: false,
    });
  }

  get hasSessions() {
    return this.recentSessions.length > 0;
  }

  get ratings(): CategoryRating[] {
    return this.homeStats?.ratings ?? [];
  }

  /** The chosen category while it has a line, else the latest session's. */
  get chartRating(): CategoryRating | null {
    const chosen = this.ratings.find(
      (rating) => rating.category === this.chartCategory
    );

    return chosen ?? this.ratings[0] ?? null;
  }

  get iratingSteps() {
    const rating = this.chartRating;

    if (rating === null) {
      return [];
    }

    return iratingSteps(rating.history, this.iratingRange, this.homeStatsAtS);
  }

  /** The calendar's weeks, Monday first, the current week last. */
  get drivenWeeks(): DrivenDay[][] {
    return drivenWeeks(this.homeStats?.driven ?? [], this.homeStatsAtS);
  }

  /** The calendar's darkest shade: the longest day in it. */
  get longestDrivenDayS(): number {
    return Math.max(0, ...this.drivenWeeks.flat().map((day) => day.timeInCarS));
  }

  get topCars(): TimeDriven[] {
    return this.homeStats?.topCars ?? [];
  }

  get topTracks(): TimeDriven[] {
    return this.homeStats?.topTracks ?? [];
  }

  get lastRace(): LastRace | null {
    return this.homeStats?.lastRace ?? null;
  }

  selectChartCategory(category: string) {
    this.chartCategory = category;
  }

  setIratingRange(range: IratingRange) {
    this.iratingRange = range;
  }

  async start() {
    const unlisten = await listenStatsImport((status) =>
      this.applyStatus(status)
    );

    if (this.disposed) {
      unlisten();

      return;
    }

    this.unlisten = unlisten;

    const status = await getStatsImportStatus();

    runInAction(() => {
      this.importStatus = status;
    });
    await Promise.all([
      this.loadSessions(),
      this.loadAutolog(),
      this.loadFolder(),
      this.loadSkippedFiles(),
    ]);
  }

  /**
   * Asks for a folder; a closed picker changes nothing. Rejects with the
   * backend's reason when the folder is refused.
   */
  async chooseFolder() {
    const picked = await pickStatsFolder(this.folder?.path ?? null);

    if (picked === null) {
      return;
    }

    const folder = await setStatsFolder(picked);

    runInAction(() => {
      this.folder = folder;
    });
  }

  /** Back to the game's own folder. */
  async useDefaultFolder() {
    const folder = await setStatsFolder(null);

    runInAction(() => {
      this.folder = folder;
    });
  }

  /** Reads every file in the folder again, the skipped ones too. */
  async reimport() {
    await reimportStats();
  }

  /**
   * Writes every session record to a file the driver picks; `null` when the
   * picker is closed.
   */
  async exportCsv(): Promise<CsvExport | null> {
    const path = await pickSessionsCsvTarget(
      `marble-trace-sessions-${fileStamp()}.csv`
    );

    if (path === null) {
      return null;
    }

    const count = await exportSessionsCsv(path);

    return { path, count };
  }

  /** Writes the setting into the game's app.ini; refused while the game runs. */
  async enableAutolog() {
    this.enablingAutolog = true;
    this.autologError = null;

    try {
      const autolog = await enableAutolog();

      runInAction(() => {
        this.autolog = autolog;
      });
    } catch (error) {
      runInAction(() => {
        this.autologError = String(error);
      });
    } finally {
      runInAction(() => {
        this.enablingAutolog = false;
      });
    }
  }

  dispose() {
    this.disposed = true;
    this.unlisten?.();
    this.unlisten = null;
  }

  private applyStatus(status: StatsImportStatus) {
    const previous = this.importStatus;
    this.importStatus = status;

    // A file was stored, or a pass ended: the table may have changed.
    const fileFinished = status.done !== previous.done;
    const passEnded = status.phase === 'idle' && previous.phase !== 'idle';

    if (fileFinished || passEnded) {
      void this.loadSessions();
    }

    if (status.broken !== previous.broken || passEnded) {
      void this.loadSkippedFiles();
    }

    // A pass ends when the game closes, and the game writes its settings then.
    if (passEnded) {
      void this.loadAutolog();
    }
  }

  private async loadFolder() {
    try {
      const folder = await getStatsFolder();

      runInAction(() => {
        this.folder = folder;
      });
    } catch (error) {
      console.error('Stats folder not read', error);
    }
  }

  private async loadSkippedFiles() {
    try {
      const skippedFiles = await getSkippedFiles();

      runInAction(() => {
        this.skippedFiles = skippedFiles;
      });
    } catch (error) {
      console.error('Skipped files not read', error);
    }
  }

  private async loadAutolog() {
    try {
      const autolog = await getAutologState();

      runInAction(() => {
        this.autolog = autolog;
      });
    } catch (error) {
      console.error('Autolog state not read', error);
    }
  }

  private async loadSessions() {
    try {
      const [sessions, homeStats, knownCars] = await Promise.all([
        getRecentSessions(RECENT_SESSIONS_LIMIT),
        getHomeStats(),
        getKnownCars(),
      ]);

      runInAction(() => {
        this.recentSessions = sessions;
        this.homeStats = homeStats;
        this.knownCars = knownCars;
        this.homeStatsAtS = Date.now() / MS_PER_SECOND;
        this.loaded = true;
      });
    } catch (error) {
      console.error('Statistics not loaded', error);
      runInAction(() => {
        this.loaded = true;
      });
    }
  }
}
