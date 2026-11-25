import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent } from '@tauri-apps/plugin-updater';

/** A release newer than the running build. */
export interface AvailableUpdate {
  version: string;
  notes: string | null;
}

export interface UpdateDownloadProgress {
  downloadedBytes: number;
  totalBytes: number | null;
  finished: boolean;
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
export const installUpdateAndRelaunch = async (
  onProgress: (progress: UpdateDownloadProgress) => void
): Promise<boolean> => {
  const update = await check();

  if (!update) {
    return false;
  }

  let downloadedBytes = 0;
  let totalBytes: number | null = null;
  const onDownloadEvent = (event: DownloadEvent) => {
    switch (event.event) {
      case 'Started':
        downloadedBytes = 0;
        totalBytes = event.data.contentLength || null;
        break;
      case 'Progress':
        downloadedBytes += event.data.chunkLength;
        break;
      case 'Finished':
        break;
    }

    onProgress({
      downloadedBytes,
      totalBytes,
      finished: event.event === 'Finished',
    });
  };

  await update.downloadAndInstall(onDownloadEvent);
  await relaunch();

  return true;
};

/** Restarts the app. */
export const relaunchApp = (): Promise<void> => relaunch();
