import { reaction, type IReactionDisposer } from 'mobx';

import {
  setStatsFolder,
  takeLegacyStatsFolder,
} from '@shared/api/stats.service';
import type { MainRoot } from '@app/roots/main-root';

type StatsFolderRoot = Pick<MainRoot, 'appSettings' | 'statistics'>;

/**
 * Sends the backend the folder statistics read from. The import waits for the
 * first push, so every start makes one: the settings' folder, or the game's
 * own while the settings are locked.
 */
const pushStatsFolder = async (root: StatsFolderRoot, path: string | null) => {
  try {
    root.statistics.applyFolder(await setStatsFolder(path));
  } catch (error) {
    console.error('Stats folder not sent', error);
  }
};

/**
 * A `stats.db` from before ADR-0015 held the folder itself; the backend hands
 * it over once and it lands in the settings, unless they already name one.
 */
export const adoptLegacyStatsFolder = async (root: StatsFolderRoot) => {
  try {
    const legacy = await takeLegacyStatsFolder();

    if (legacy !== null && root.appSettings.appSettings.statsFolder === null) {
      root.appSettings.update({ statsFolder: legacy });
    }
  } catch (error) {
    console.error('Legacy stats folder not read', error);
  }
};

/** Locked settings hold no folder main may trust: the game's own is read. */
export const pushDefaultStatsFolder = (root: StatsFolderRoot) =>
  pushStatsFolder(root, null);

/** Registered after hydration, so the first push is the user's folder. */
export const registerStatsFolderReaction = (
  root: StatsFolderRoot
): IReactionDisposer =>
  reaction(
    () => root.appSettings.appSettings.statsFolder,
    (path) => void pushStatsFolder(root, path),
    { fireImmediately: true }
  );
