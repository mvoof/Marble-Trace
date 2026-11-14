import { makeAutoObservable, runInAction } from 'mobx';

import {
  getHomeStats,
  getRecentSessions,
  getStatsImportStatus,
  listenStatsImport,
} from '@shared/api/stats.service';
import type {
  CategoryRating,
  HomeStats,
  RecentSession,
  StatsImportStatus,
  TimeDriven,
} from '@shared/contracts/generated/bindings';
import { drivenWeeks, type DrivenDay } from './days-driven';
import { iratingSteps, type IratingRange } from './home-stats';

/** Rows of the recent sessions table on Home. */
const RECENT_SESSIONS_LIMIT = 10;
const MS_PER_SECOND = 1000;

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
    await this.loadSessions();
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
  }

  private async loadSessions() {
    try {
      const [sessions, homeStats] = await Promise.all([
        getRecentSessions(RECENT_SESSIONS_LIMIT),
        getHomeStats(),
      ]);

      runInAction(() => {
        this.recentSessions = sessions;
        this.homeStats = homeStats;
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
