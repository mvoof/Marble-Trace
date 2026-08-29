import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import type {
  CompanionApp,
  CompanionStatus,
  DetectedApp,
} from '@/types/bindings';

export const detectCompanionApps = () =>
  invoke<DetectedApp[]>('detect_companion_apps');

export const companionAppStatuses = (apps: CompanionApp[]) =>
  invoke<CompanionStatus[]>('companion_app_statuses', { apps });

/** Resolves false when an instance was already running. */
export const launchCompanionApp = (app: CompanionApp) =>
  invoke<boolean>('launch_companion_app', { app });

/** Resolves false when this app is not the one that started it. */
export const closeCompanionApp = (app: CompanionApp) =>
  invoke<boolean>('close_companion_app', { app });

export const companionAppIcon = (path: string) =>
  invoke<string | null>('companion_app_icon', { path });

/** Closes everything marked to close with the app. Resolves with the names
 *  that were still running when the wait ran out. */
export const closeCompanionApps = (apps: CompanionApp[]) =>
  invoke<string[]>('close_companion_apps', { apps });

/** The file picker, scoped to executables. Null when the user cancelled. */
export const pickExecutable = async (): Promise<string | null> => {
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Programs', extensions: ['exe', 'lnk', 'bat', 'cmd'] }],
  });

  return typeof picked === 'string' ? picked : null;
};
