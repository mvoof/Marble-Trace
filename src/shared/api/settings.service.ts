import { invoke } from '@tauri-apps/api/core';

import type { TelemetrySettings } from '@shared/contracts/generated/bindings';

export const settingsFileExists = async (): Promise<boolean> =>
  invoke('settings_file_exists');

export const backupSettingsFile = async (suffix: string): Promise<void> =>
  invoke('backup_settings_file', { suffix });

export const keepLastGoodSettings = async (): Promise<void> =>
  invoke('keep_last_good_settings');

/** Milliseconds since the epoch, or `null` when there is no copy. */
export const lastGoodSettingsSavedAt = async (): Promise<number | null> =>
  invoke('last_good_settings_saved_at');

export const restoreLastGoodSettings = async (): Promise<void> =>
  invoke('restore_last_good_settings');

// The snapshot is a diagnostic blob the backend only logs; typing it here
// would couple the transport layer to the store-side `Settings` shape.
export const logSettingsSnapshot = async (settings: unknown): Promise<void> =>
  invoke('log_settings_snapshot', { settings });

export const deleteSettingsFile = async (): Promise<void> =>
  invoke('delete_settings_file');

/**
 * The user's telemetry settings, whole — the backend applies them as one
 * value. Fire-and-forget: the caller is a reaction that sends them again on
 * the next change.
 */
export const setTelemetrySettingsSilent = (
  settings: TelemetrySettings
): void => {
  invoke('set_telemetry_settings', { settings }).catch((error) =>
    console.error('[settings.service] set_telemetry_settings failed:', error)
  );
};
