import { makeAutoObservable, runInAction } from 'mobx';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { load } from '@tauri-apps/plugin-store';
import { getVersion } from '@tauri-apps/api/app';
import { mergeWithDefaults } from '@utils/deep-merge';
import { detectSystemLanguage } from '@utils/system-locale';
import i18n from '@/i18n';

export type AppLanguage = 'system' | 'en' | 'ru' | 'zh';

export const resolveAppLanguage = (language: AppLanguage) =>
  language === 'system' ? detectSystemLanguage() : language;

export type InteractHotkeyMode = 'toggle' | 'hold';

const MS_PER_SECOND = 1000;

const DEFAULT_APP_SETTINGS = {
  // Keys and device buttons live in the app-level binding registry
  // (store/hotkeys), not here — one set covers every layout.
  // One-shot: the old per-layout `*Hotkey` fields have been lifted into it.
  bindingsMigrated: false,
  // Interact mode: mouse events reach the overlay without unlocking widget
  // dragging. Whether its binding toggles or is held is a property of the
  // action rather than of the binding, so it stays here.
  // 'toggle' — the binding flips the mode on and off, 'hold' — active only while held.
  interactHotkeyMode: 'toggle' as InteractHotkeyMode,
  // Seconds of interact mode before it switches itself off (0 = stay on). Toggle mode only.
  interactAutoOffSeconds: 15,
  hideWidgetsWhenGameClosed: false,
  hideAllWidgets: false,
  autoSwitchLayouts: true,
  startMinimized: false,
  autoUpdate: true,
  updateCheckInterval: 3,
  lastUpdateCheck: null as string | null,
  // Layout editor preferences (persisted across sessions).
  editorShowGrid: false,
  editorSnapToGrid: true,
  // Overlay-space grid pitch (px). Drives both the visual grid and snapping.
  editorGridSize: 20,
  language: 'system' as AppLanguage,
  // Physical rotation range of the driver's wheel, in degrees, lock to lock.
  // A property of the hardware rather than of any one widget or layout, so
  // every steering visual (input trace, race dash marker) reads it from here.
  steeringLock: 900,
  // Stream chat source. A channel is a property of the account, not of a
  // layout — the same reasoning as steeringLock above. Keeping it here also
  // means one connection serves every layout instead of reconnecting on each
  // layout switch.
  streamChatTwitchChannel: '',
  streamChatYoutubeTarget: '',
  /** Twitch application client id, needed only for the optional sign-in. */
  streamChatTwitchClientId: '',
  /** Display only. The tokens themselves live in the OS credential store and
   *  never appear in this file — mergeWithDefaults prunes the old plaintext
   *  keys from settings.json on the next save. */
  streamChatTwitchLogin: null as string | null,
  /** Bumped on sign-in and sign-out so the backend knows to reconnect. */
  streamChatAuthRevision: 0,
  streamChatHideCommands: true,
  streamChatIgnoredBots: 'Nightbot, StreamElements, Moobot',
};

export type AppSettings = typeof DEFAULT_APP_SETTINGS;

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

export class AppSettingsStore {
  appSettings: AppSettings = { ...DEFAULT_APP_SETTINGS };

  dragMode = false;
  interactMode = false;
  updateStatus: UpdateStatus = 'idle';
  availableVersion: string | null = null;
  releaseNotes: string | null = null;
  currentVersion = '';
  updateError: string | null = null;
  private updateTimer: number | null = null;
  private interactAutoOffTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  init() {
    void this._initAsync().catch((err) =>
      console.error('Failed to initialize AppSettingsStore:', err)
    );
  }

  private async _initAsync() {
    const version = await getVersion();

    runInAction(() => {
      this.currentVersion = version;
    });

    if (this.appSettings.autoUpdate) {
      void this.checkForUpdates(true);

      this.startUpdateTimer();
    }
  }

  private startUpdateTimer() {
    this.stopUpdateTimer();

    if (!this.appSettings.autoUpdate) return;

    const ms = this.appSettings.updateCheckInterval * 60 * 60 * 1000;

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
    const merged = mergeWithDefaults(DEFAULT_APP_SETTINGS, saved);
    Object.assign(this.appSettings, merged);
    void i18n.changeLanguage(resolveAppLanguage(this.appSettings.language));
  }

  setLanguage(value: AppLanguage) {
    this.appSettings.language = value;
    void i18n.changeLanguage(resolveAppLanguage(value));
  }

  setAutoUpdate(value: boolean) {
    this.appSettings.autoUpdate = value;

    if (value) {
      this.startUpdateTimer();
    } else {
      this.stopUpdateTimer();
    }
  }

  setUpdateCheckInterval(value: number) {
    this.appSettings.updateCheckInterval = value;

    if (this.appSettings.autoUpdate) {
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
        this.appSettings.lastUpdateCheck = new Date().toISOString();

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
    this.setDragMode(!this.dragMode);
  }

  toggleHideAllWidgets() {
    this.appSettings.hideAllWidgets = !this.appSettings.hideAllWidgets;
  }

  // Drag and interact both grab the mouse, but fight over it: drag consumes
  // pointer events on the container while interact needs them to reach widget
  // content. Only one may be active at a time.
  setDragMode(value: boolean) {
    this.dragMode = value;

    if (value) {
      this.setInteractMode(false);
    }
  }

  toggleInteractMode() {
    this.setInteractMode(!this.interactMode);
  }

  /**
   * Interact mode lets the mouse reach the overlay, which means the game stops
   * receiving it — so toggle mode arms a watchdog that switches it back off.
   */
  setInteractMode(value: boolean) {
    this.interactMode = value;

    if (value) {
      this.dragMode = false;
    }

    if (this.interactAutoOffTimer !== null) {
      clearTimeout(this.interactAutoOffTimer);
      this.interactAutoOffTimer = null;
    }

    const autoOffSeconds = this.appSettings.interactAutoOffSeconds;

    if (!value || autoOffSeconds <= 0) {
      return;
    }

    this.interactAutoOffTimer = setTimeout(() => {
      runInAction(() => {
        this.interactMode = false;
        this.interactAutoOffTimer = null;
      });
    }, autoOffSeconds * MS_PER_SECOND);
  }

  setInteractHotkeyMode(mode: InteractHotkeyMode) {
    this.appSettings.interactHotkeyMode = mode;

    this.setInteractMode(false);
  }

  // The watchdog holds the duration it was armed with, so a change made while
  // interact mode is already on has to re-arm it with the new one.
  setInteractAutoOffSeconds(seconds: number) {
    this.appSettings.interactAutoOffSeconds = seconds;

    if (this.interactMode) {
      this.setInteractMode(true);
    }
  }

  setHideAllWidgets(value: boolean) {
    this.appSettings.hideAllWidgets = value;
  }

  setStartMinimized(value: boolean) {
    this.appSettings.startMinimized = value;
  }

  setHideWidgetsWhenGameClosed(value: boolean) {
    this.appSettings.hideWidgetsWhenGameClosed = value;
  }

  setSteeringLock(value: number) {
    this.appSettings.steeringLock = value;
  }

  setStreamChatTwitchChannel(value: string) {
    this.appSettings.streamChatTwitchChannel = value;
  }

  setStreamChatYoutubeTarget(value: string) {
    this.appSettings.streamChatYoutubeTarget = value;
  }

  setStreamChatTwitchClientId(value: string) {
    this.appSettings.streamChatTwitchClientId = value;
  }

  setStreamChatTwitchLogin(login: string | null) {
    this.appSettings.streamChatTwitchLogin = login;
    this.appSettings.streamChatAuthRevision += 1;
  }

  setStreamChatHideCommands(value: boolean) {
    this.appSettings.streamChatHideCommands = value;
  }

  setStreamChatIgnoredBots(value: string) {
    this.appSettings.streamChatIgnoredBots = value;
  }

  setAutoSwitchLayouts(value: boolean) {
    this.appSettings.autoSwitchLayouts = value;
  }

  setEditorShowGrid(value: boolean) {
    this.appSettings.editorShowGrid = value;
  }

  setEditorSnapToGrid(value: boolean) {
    this.appSettings.editorSnapToGrid = value;
  }

  setEditorGridSize(value: number) {
    this.appSettings.editorGridSize = value;
  }

  async resetSettings() {
    const store = await load('settings.json');

    await store.clear();
    await store.save();
    await relaunch();
  }
}
