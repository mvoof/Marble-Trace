import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import { STATS_IMPORT_EVENT } from '@shared/contracts/generated/backend-events';
import type {
  HomeStats,
  RecentSession,
  StatsImportStatus,
} from '@shared/contracts/generated/bindings';

export const getStatsImportStatus = () =>
  invoke<StatsImportStatus>('get_stats_import_status');

export const getRecentSessions = (limit: number) =>
  invoke<RecentSession[]>('get_recent_sessions', { limit });

export const getHomeStats = () => invoke<HomeStats>('get_home_stats');

export const listenStatsImport = (
  onStatus: (status: StatsImportStatus) => void
): Promise<UnlistenFn> =>
  listen<StatsImportStatus>(STATS_IMPORT_EVENT, (event) =>
    onStatus(event.payload)
  );
