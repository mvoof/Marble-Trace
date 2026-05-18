import { makeAutoObservable, runInAction } from 'mobx';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';

const DEFAULT_APP_SETTINGS = {
  dragHotkey: 'F9',
  hideAllWidgetsHotkey: 'F10',
  hideWidgetsWhenGameClosed: false,
  hideAllWidgets: false,
  autoUpdate: true,
  updateCheckInterval: 3,
  lastUpdateCheck: null as string | null,
};

export type AppSettings = typeof DEFAULT_APP_SETTINGS;

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

class AppSettingsStore {
  settings: AppSettings = { ...DEFAULT_APP_SETTINGS };

  dragMode = false;
  updateStatus: UpdateStatus = 'idle';
  availableVersion: string | null = null;
  releaseNotes: string | null = null;
  currentVersion = '';
  updateError: string | null = null;
  private updateTimer: number | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });

    void this.init().catch((err) =>
      console.error('Failed to initialize AppSettingsStore:', err)
    );
  }

  async init() {
    const version = await getVersion();

    runInAction(() => {
      this.currentVersion = version;
    });

    if (this.settings.autoUpdate) {
      void this.checkForUpdates(true);

      this.startUpdateTimer();
    }
  }

  private startUpdateTimer() {
    this.stopUpdateTimer();

    if (!this.settings.autoUpdate) return;

    const ms = this.settings.updateCheckInterval * 60 * 60 * 1000;

    this.updateTimer = window.setInterval(() => {
      void this.checkForUpdates(true);
    }, ms);
  }

  private stopUpdateTimer() {
    if (this.updateTimer !== null) {
      window.clearInterval(this.updateTimer);

      this.updateTimer = null;
    }
  }

  applySettings(saved: Partial<AppSettings>) {
    const filtered = Object.fromEntries(
      (Object.keys(DEFAULT_APP_SETTINGS) as (keyof AppSettings)[]).map(
        (key) => [key, key in saved ? saved[key] : DEFAULT_APP_SETTINGS[key]]
      )
    );

    Object.assign(this.settings, filtered);
  }

  setAutoUpdate(value: boolean) {
    this.settings.autoUpdate = value;

    if (value) {
      this.startUpdateTimer();
    } else {
      this.stopUpdateTimer();
    }
  }

  setUpdateCheckInterval(value: number) {
    this.settings.updateCheckInterval = value;

    if (this.settings.autoUpdate) {
      this.startUpdateTimer();
    }
  }

  async checkForUpdates(silent = false) {
    if (this.updateStatus === 'checking' || this.updateStatus === 'downloading')
      return;

    runInAction(() => {
      this.updateStatus = 'checking';
      this.updateError = null;
    });

    try {
      const update = await check();

      runInAction(() => {
        this.settings.lastUpdateCheck = new Date().toISOString();

        if (update) {
          this.updateStatus = 'available';
          this.availableVersion = update.version;
          this.releaseNotes = update.body ?? null;
        } else {
          this.updateStatus = 'idle';
          this.availableVersion = null;
          this.releaseNotes = null;

          if (!silent) {
            // manual check success
          }
        }
      });
    } catch (err) {
      console.error('Failed to check for updates:', err);

      runInAction(() => {
        this.updateStatus = 'error';
        this.updateError = String(err);
      });
    }
  }

  async installUpdate() {
    if (this.updateStatus !== 'available') return;

    runInAction(() => {
      this.updateStatus = 'downloading';
      this.updateError = null;
    });

    try {
      const update = await check();

      if (update) {
        await update.downloadAndInstall();

        runInAction(() => {
          this.updateStatus = 'ready';
        });

        await relaunch();
      } else {
        runInAction(() => {
          this.updateStatus = 'idle';
          this.availableVersion = null;
        });
      }
    } catch (err) {
      console.error('Failed to install update:', err);

      runInAction(() => {
        this.updateStatus = 'error';
        this.updateError = String(err);
      });
    }
  }

  toggleDragMode() {
    this.dragMode = !this.dragMode;
  }

  toggleHideAllWidgets() {
    this.settings.hideAllWidgets = !this.settings.hideAllWidgets;
  }

  setDragMode(value: boolean) {
    this.dragMode = value;
  }

  setHideAllWidgets(value: boolean) {
    this.settings.hideAllWidgets = value;
  }

  setHideAllWidgetsHotkey(key: string) {
    this.settings.hideAllWidgetsHotkey = key;
  }

  setDragHotkey(key: string) {
    this.settings.dragHotkey = key;
  }

  setHideWidgetsWhenGameClosed(value: boolean) {
    this.settings.hideWidgetsWhenGameClosed = value;
  }
}

export const appSettingsStore = new AppSettingsStore();
