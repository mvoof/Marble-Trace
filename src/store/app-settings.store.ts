import { makeAutoObservable, runInAction } from 'mobx';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';

const DEFAULT_DRAG_HOTKEY = 'F9';
const DEFAULT_HIDE_ALL_HOTKEY = 'F10';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

class AppSettingsStore {
  dragMode = false;
  dragHotkey: string = DEFAULT_DRAG_HOTKEY;
  hideWidgetsWhenGameClosed = false;
  hideAllWidgets = false;
  hideAllWidgetsHotkey: string = DEFAULT_HIDE_ALL_HOTKEY;

  // Update system
  autoUpdate = true;
  updateCheckInterval = 3; // hours
  updateStatus: UpdateStatus = 'idle';
  availableVersion: string | null = null;
  currentVersion = '';
  lastUpdateCheck: string | null = null;
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

    if (this.autoUpdate) {
      void this.checkForUpdates(true);
      this.startUpdateTimer();
    }
  }

  private startUpdateTimer() {
    this.stopUpdateTimer();
    if (!this.autoUpdate) return;

    const ms = this.updateCheckInterval * 60 * 60 * 1000;
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
        this.lastUpdateCheck = new Date().toISOString();
        if (update) {
          this.updateStatus = 'available';
          this.availableVersion = update.version;
        } else {
          this.updateStatus = 'idle';
          this.availableVersion = null;
          if (!silent) {
            // Logic for manual check success can go here if needed
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

  setAutoUpdate(value: boolean) {
    this.autoUpdate = value;
    if (value) {
      this.startUpdateTimer();
    } else {
      this.stopUpdateTimer();
    }
  }

  setUpdateCheckInterval(value: number) {
    this.updateCheckInterval = value;
    if (this.autoUpdate) {
      this.startUpdateTimer();
    }
  }

  setLastUpdateCheck(value: string) {
    this.lastUpdateCheck = value;
  }

  toggleDragMode() {
    this.dragMode = !this.dragMode;
  }

  toggleHideAllWidgets() {
    this.hideAllWidgets = !this.hideAllWidgets;
  }

  setDragMode(value: boolean) {
    this.dragMode = value;
  }

  setHideWidgetsWhenGameClosed(value: boolean) {
    this.hideWidgetsWhenGameClosed = value;
  }

  setHideAllWidgets(value: boolean) {
    this.hideAllWidgets = value;
  }

  setDragHotkey(hotkey: string) {
    this.dragHotkey = hotkey;
  }

  setHideAllWidgetsHotkey(hotkey: string) {
    this.hideAllWidgetsHotkey = hotkey;
  }
}

export const appSettingsStore = new AppSettingsStore();
