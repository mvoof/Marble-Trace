import { invoke } from '@tauri-apps/api/core';

export const settingsFileExists = async (): Promise<boolean> =>
  invoke('settings_file_exists');

export const backupSettingsFile = async (suffix: string): Promise<void> =>
  invoke('backup_settings_file', { suffix });

// The snapshot is a diagnostic blob the backend only logs; typing it here
// would couple the transport layer to the store-side `Settings` shape.
export const logSettingsSnapshot = async (settings: unknown): Promise<void> =>
  invoke('log_settings_snapshot', { settings });

export const deleteSettingsFile = async (): Promise<void> =>
  invoke('delete_settings_file');

/** Fire-and-forget backend mirrors of widget settings: callers never await. */
export const setPitWarningLapsSilent = (laps: number): void => {
  invoke('set_pit_warning_laps', { laps }).catch((error) =>
    console.error('[settings.service] set_pit_warning_laps failed:', error)
  );
};

export const setFuelAvgWindowSilent = (window: number): void => {
  invoke('set_fuel_avg_window', { window }).catch((error) =>
    console.error('[settings.service] set_fuel_avg_window failed:', error)
  );
};

export const setCarLengthSilent = (length: number): void => {
  invoke('set_car_length', { length }).catch((error) =>
    console.error('[settings.service] set_car_length failed:', error)
  );
};
