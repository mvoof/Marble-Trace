import { makeAutoObservable, runInAction } from 'mobx';

import { fileStamp } from '@shared/api/file-export.service';
import {
  enableAutolog,
  exportSessionsCsv,
  getAutologState,
  getHomeStats,
  getKnownCars,
  getRecentSessions,
  getSessionsPage,
  getSkippedFiles,
  getStatsImportStatus,
  listenStatsImport,
  pickSessionsCsvTarget,
  pickStatsFolder,
  reimportStats,
} from '@shared/api/stats.service';
import type {
  AutologState,
  HomeStats,
  KnownCar,
  LastRace,
  RecentSession,
  SkippedFile,
  StatsFolder,
  StatsImportStatus,
  TimeDriven,
} from '@shared/contracts/generated/bindings';
import {
  drivenWeeks,
  drivenYears,
  yearOf,
  type DrivenDay,
} from './days-driven';
import { SessionsTableStore } from './sessions-table.store';

/** One session is enough to know Home has any: the table loads its own pages. */
const RECENT_SESSIONS_LIMIT = 1;
const MS_PER_SECOND = 1000;

/** What the store writes the folder choice into: the settings, main's own. */
type StatisticsDeps = {
  appSettings: { update(patch: { statsFolder: string | null }): void };
};

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
  /** When `homeStats` was counted, unix seconds: the calendar ends there. */
  homeStatsAtS = 0;
  /** The year the calendar shows; `null` follows the current one. */
  calendarYear: number | null = null;
  /** The first load has answered, so an empty list means no sessions. */
  loaded = false;
  /** Whether the game writes the files statistics read; `null` until asked. */
  autolog: AutologState | null = null;
  enablingAutolog = false;
  /** Why turning logging on failed, as the backend said it. */
  autologError: string | null = null;
  /** Where the import reads from, as the backend took it; `null` until main
   *  has sent the settings' folder. */
  folder: StatsFolder | null = null;
  /** The files the import could not read, the latest tried first. */
  skippedFiles: SkippedFile[] = [];
  /** The cars of the session records, by name. */
  knownCars: KnownCar[] = [];
  /** Home's sessions table: its filter and the page served. */
  readonly sessionsTable = new SessionsTableStore(getSessionsPage);

  private unlisten: (() => void) | null = null;
  private disposed = false;

  constructor(private deps: StatisticsDeps) {
    makeAutoObservable<StatisticsStore, 'unlisten' | 'disposed' | 'deps'>(
      this,
      {
        unlisten: false,
        disposed: false,
        deps: false,
      }
    );
  }

  get hasSessions() {
    return this.recentSessions.length > 0;
  }

  /** The first and last years the calendar pages through. */
  get calendarYears(): { first: number; last: number } {
    return drivenYears(this.homeStats?.driven ?? [], this.homeStatsAtS);
  }

  /** The year the calendar shows, within the years driven. */
  get shownYear(): number {
    const { first, last } = this.calendarYears;
    const year = this.calendarYear ?? yearOf(this.homeStatsAtS);

    return Math.min(Math.max(year, first), last);
  }

  get canShowPreviousYear(): boolean {
    return this.shownYear > this.calendarYears.first;
  }

  get canShowNextYear(): boolean {
    return this.shownYear < this.calendarYears.last;
  }

  /** The calendar's weeks of the shown year, Monday first. */
  get drivenWeeks(): DrivenDay[][] {
    return drivenWeeks(
      this.homeStats?.driven ?? [],
      this.shownYear,
      this.homeStatsAtS
    );
  }

  /** The calendar's darkest shade: the longest day of the shown year. */
  get longestDrivenDayS(): number {
    return Math.max(
      0,
      ...this.drivenWeeks
        .flat()
        .filter((day) => !day.outside)
        .map((day) => day.timeInCarS)
    );
  }

  showPreviousYear() {
    if (this.canShowPreviousYear) {
      this.calendarYear = this.shownYear - 1;
    }
  }

  showNextYear() {
    if (this.canShowNextYear) {
      this.calendarYear = this.shownYear + 1;
    }
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

  /** The first word of the name the latest session was driven under. */
  get driverFirstName(): string | null {
    const [firstName] = (this.homeStats?.driverName ?? '').trim().split(/\s+/);

    return firstName === undefined || firstName === '' ? null : firstName;
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
      this.loadSkippedFiles(),
    ]);
  }

  /**
   * Asks for a folder and writes it into the settings; a closed picker
   * changes nothing. Main sends the new folder to the import.
   */
  async chooseFolder() {
    const picked = await pickStatsFolder(this.folder?.path ?? null);

    if (picked === null) {
      return;
    }

    this.deps.appSettings.update({ statsFolder: picked });
  }

  /** Back to the game's own folder. */
  useDefaultFolder() {
    this.deps.appSettings.update({ statsFolder: null });
  }

  /** The folder the backend took, as it answered main's push. */
  applyFolder(folder: StatsFolder) {
    this.folder = folder;
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

  /** Home's figures and the sessions table, read again. */
  async loadSessions() {
    try {
      const [sessions, homeStats, knownCars] = await Promise.all([
        getRecentSessions(RECENT_SESSIONS_LIMIT),
        getHomeStats(),
        getKnownCars(),
        this.sessionsTable.reload(),
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
