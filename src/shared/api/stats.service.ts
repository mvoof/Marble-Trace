import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open, save } from '@tauri-apps/plugin-dialog';

import { STATS_IMPORT_EVENT } from '@shared/contracts/generated/backend-events';
import type {
  AutologState,
  HomeStats,
  KnownCar,
  RecentSession,
  SkippedFile,
  StatsFolder,
  StatsImportStatus,
} from '@shared/contracts/generated/bindings';

const CSV_EXTENSIONS = ['csv'];

export const getStatsImportStatus = () =>
  invoke<StatsImportStatus>('get_stats_import_status');

export const getRecentSessions = (limit: number) =>
  invoke<RecentSession[]>('get_recent_sessions', { limit });

export const getHomeStats = () => invoke<HomeStats>('get_home_stats');

export const getAutologState = () => invoke<AutologState>('get_autolog_state');

export const enableAutolog = () => invoke<AutologState>('enable_autolog');

export const getStatsFolder = () => invoke<StatsFolder>('get_stats_folder');

/** `null` goes back to the game's own folder. */
export const setStatsFolder = (path: string | null) =>
  invoke<StatsFolder>('set_stats_folder', { path });

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
