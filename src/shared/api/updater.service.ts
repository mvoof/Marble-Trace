import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';

/** A release newer than the running build. */
export interface AvailableUpdate {
  version: string;
  notes: string | null;
}

/** The running build's version. */
export const getAppVersion = (): Promise<string> => getVersion();

/** Asks the update server for a newer release; `null` when this one is the latest. */
export const checkForUpdate = async (): Promise<AvailableUpdate | null> => {
  const update = await check();

  return update
    ? { version: update.version, notes: update.body ?? null }
    : null;
};

/**
 * Downloads and installs the newer release, then restarts into it. Resolves
 * `false`, without restarting, when there is none any more.
 */
export const installUpdateAndRelaunch = async (): Promise<boolean> => {
  const update = await check();

  if (!update) {
    return false;
  }

  await update.downloadAndInstall();
  await relaunch();

  return true;
};

/** Restarts the app. */
export const relaunchApp = (): Promise<void> => relaunch();
