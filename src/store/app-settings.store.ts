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
  updateStatus: UpdateStatus = 'idle';
  availableVersion: string | null = null;
  currentVersion = '';
  updateError: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
    void this.init();
  }

  async init() {
    const version = await getVersion();
    runInAction(() => {
      this.currentVersion = version;
    });

    if (this.autoUpdate) {
      void this.checkForUpdates(true);
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
    });

    try {
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        runInAction(() => {
          this.updateStatus = 'ready';
        });
        await relaunch();
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
