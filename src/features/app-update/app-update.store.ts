import { makeAutoObservable, reaction, runInAction } from 'mobx';

import type { AppSettingsStore } from '@entities/app-settings/app-settings.store';
import {
  checkForUpdate,
  getAppVersion,
  installUpdateAndRelaunch,
} from '@shared/api/updater.service';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Checking for a newer release and installing it. Main only: the settings it
 * follows (`autoUpdate`, `updateCheckInterval`) are main's, and one window
 * asking the server is enough.
 */
export class AppUpdateStore {
  status: UpdateStatus = 'idle';
  availableVersion: string | null = null;
  releaseNotes: string | null = null;
  currentVersion = '';
  error: string | null = null;

  private timer: number | null = null;
  private stopFollowingSettings: (() => void) | null = null;

  constructor(private readonly appSettings: AppSettingsStore) {
    makeAutoObservable<AppUpdateStore, 'timer' | 'stopFollowingSettings'>(
      this,
      { timer: false, stopFollowingSettings: false },
      { autoBind: true }
    );
  }

  /** Reads the running version. Safe before the settings are loaded. */
  init() {
    void getAppVersion()
      .then((version) => {
        runInAction(() => {
          this.currentVersion = version;
        });
      })
      .catch((error: unknown) =>
        console.error('[app-update] failed to read the app version', error)
      );
  }

  /**
   * Starts checking on the user's schedule, and follows the schedule as it
   * changes. Call once the settings are loaded, or it checks on defaults.
   */
  start() {
    this.stopFollowingSettings?.();
    this.stopFollowingSettings = reaction(
      () => ({
        isOn: this.appSettings.appSettings.autoUpdate,
        intervalHours: this.appSettings.appSettings.updateCheckInterval,
      }),
      ({ isOn, intervalHours }, previous) => {
        this.stopTimer();

        if (!isOn) {
          return;
        }

        // Turning it on, or starting with it on, checks now; a new interval
        // only re-arms the timer.
        if (!previous?.isOn) {
          void this.checkForUpdates();
        }

        this.timer = window.setInterval(() => {
          void this.checkForUpdates();
        }, intervalHours * MS_PER_HOUR);
      },
      { fireImmediately: true }
    );
  }

  dispose() {
    this.stopFollowingSettings?.();
    this.stopFollowingSettings = null;
    this.stopTimer();
  }

  async checkForUpdates() {
    if (this.status === 'checking' || this.status === 'downloading') {
      return;
    }

    this.status = 'checking';
    this.error = null;

    try {
      const update = await checkForUpdate();

      runInAction(() => {
        this.appSettings.update({ lastUpdateCheck: new Date().toISOString() });
        this.status = update ? 'available' : 'idle';
        this.availableVersion = update?.version ?? null;
        this.releaseNotes = update?.notes ?? null;
      });
    } catch (error) {
      console.error('Failed to check for updates:', error);

      runInAction(() => {
        this.status = 'error';
        this.error = String(error);
      });
    }
  }

  async installUpdate() {
    if (this.status !== 'available') {
      return;
    }

    this.status = 'downloading';
    this.error = null;

    try {
      const installed = await installUpdateAndRelaunch();

      runInAction(() => {
        if (installed) {
          this.status = 'ready';
        } else {
          this.status = 'idle';
          this.availableVersion = null;
        }
      });
    } catch (error) {
      console.error('Failed to install update:', error);

      runInAction(() => {
        this.status = 'error';
        this.error = String(error);
      });
    }
  }

  private stopTimer() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
}
