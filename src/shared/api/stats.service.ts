import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';

import { STATS_IMPORT_EVENT } from '@shared/contracts/generated/backend-events';
import type {
  AutologState,
  HomeStats,
  KnownCar,
  RecentSession,
  SessionFilter,
  SessionPage,
  SkippedFile,
  StatsFolder,
  StatsImportStatus,
} from '@shared/contracts/generated/bindings';

const CSV_EXTENSIONS = ['csv'];

export const getStatsImportStatus = () =>
  invoke<StatsImportStatus>('get_stats_import_status');

export const getRecentSessions = (limit: number) =>
  invoke<RecentSession[]>('get_recent_sessions', { limit });

/** One page of the sessions table, filtered in the database. */
export const getSessionsPage = (filter: SessionFilter, page: number) =>
  invoke<SessionPage>('get_sessions_page', { filter, page });

export const getHomeStats = () => invoke<HomeStats>('get_home_stats');

export const getAutologState = () => invoke<AutologState>('get_autolog_state');

export const enableAutolog = () => invoke<AutologState>('enable_autolog');

/** The folder `settings.json` names; `null` is the game's own. */
export const setStatsFolder = (path: string | null) =>
  invoke<StatsFolder>('set_stats_folder', { path });

/** The folder an older stats database held, once; `null` when none. */
export const takeLegacyStatsFolder = () =>
  invoke<string | null>('take_legacy_stats_folder');

/** Reads every file in the folder again, the skipped ones too. */
export const reimportStats = () => invoke<void>('reimport_stats');

export const getSkippedFiles = () => invoke<SkippedFile[]>('get_skipped_files');

/** Every car of the session records, with its class badge. */
export const getKnownCars = () => invoke<KnownCar[]>('get_known_cars');

/** Writes every session record to `path`; answers how many. */
export const exportSessionsCsv = (path: string) =>
  invoke<number>('export_sessions_csv', { path });

export const pickStatsFolder = async (
  current: string | null
): Promise<string | null> => {
  const picked = await open({
    multiple: false,
    directory: true,
    defaultPath: current ?? undefined,
  });

  return typeof picked === 'string' ? picked : null;
};

export const pickSessionsCsvTarget = (fileName: string) =>
  save({
    defaultPath: fileName,
    filters: [{ name: 'CSV', extensions: CSV_EXTENSIONS }],
  });

export const listenStatsImport = (
  onStatus: (status: StatsImportStatus) => void
): Promise<UnlistenFn> =>
  listen<StatsImportStatus>(STATS_IMPORT_EVENT, (event) =>
    onStatus(event.payload)
  );
