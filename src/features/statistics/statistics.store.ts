import { makeAutoObservable, runInAction } from 'mobx';

import {
  getRecentSessions,
  getStatsImportStatus,
  listenStatsImport,
} from '@shared/api/stats.service';
import type {
  RecentSession,
  StatsImportStatus,
} from '@shared/contracts/generated/bindings';

/** Rows of the recent sessions table on Home. */
const RECENT_SESSIONS_LIMIT = 10;

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
      const sessions = await getRecentSessions(RECENT_SESSIONS_LIMIT);

      runInAction(() => {
        this.recentSessions = sessions;
        this.loaded = true;
      });
    } catch (error) {
      console.error('Recent sessions not loaded', error);
      runInAction(() => {
        this.loaded = true;
      });
    }
  }
}
