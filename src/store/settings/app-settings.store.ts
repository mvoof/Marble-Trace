import { makeAutoObservable, runInAction } from 'mobx';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import {
  deleteSettingsFile,
  setCarLengthSilent,
} from '@platform/services/settings.service';
import { mergeWithDefaults } from '@store/deep-merge';
import { detectSystemLanguage } from '@store/settings/system-locale';
import { createRemoteToken } from '@utils/remote-screen';
import i18n from '@/i18n';
import type { AppLanguage } from '@/types';
import type { SettingsLockReason } from '@platform/settings-schema/types';

export const resolveAppLanguage = (language: AppLanguage) =>
  language === 'system' ? detectSystemLanguage() : language;

export type InteractHotkeyMode = 'toggle' | 'hold';

const MS_PER_SECOND = 1000;

const DEFAULT_APP_SETTINGS = {
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
  // Length of a car in meters, used to turn a centre-to-centre distance into
  // the gap between bumpers. A property of the field rather than of any one
  // widget — the radars and Close Battle must not disagree about how far away
  // the same car is — and the backend keeps exactly one of it per process.
  carLength: 4.4,
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
  /** Remote screens: serve layouts to devices on the network. App-level rather
   *  than per layout — one server, whichever layout is active. */
  remoteEnabled: false,
  remotePort: 8787,
  /** Off keeps the server on loopback, where only this machine can reach it. */
  remoteLan: true,
  /** Generated on first enable and embedded in the screen URLs. Empty means the
   *  user turned the check off and the server is open to the whole network. */
  remoteToken: '',
  /** Frames per second pushed to browsers. A tablet cannot show 60 and the
   *  Wi-Fi does not need to carry them. */
  remoteTelemetryHz: 30,
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

  /**
   * Set when `settings.json` could not be brought to the current schema — it
   * was written by a newer build, is older than the migration chain reaches, or
   * is not a settings file at all.
   *
   * Nothing may be written while this holds. Hydration is skipped too, so the
   * app is running on defaults it must never mistake for the user's own.
   */
  settingsLocked = false;
  settingsLockReason: SettingsLockReason | null = null;

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

  lockSettings(reason: SettingsLockReason) {
    this.settingsLocked = true;
    this.settingsLockReason = reason;
  }

  applySettings(saved: Partial<AppSettings>) {
    const merged = mergeWithDefaults(DEFAULT_APP_SETTINGS, saved);
    Object.assign(this.appSettings, merged);

    // The backend holds its own copy for the proximity computation, and it
    // starts on the shipped default: a file that says otherwise has to be
    // pushed across on the way in, not on the first time the user touches it.
    setCarLengthSilent(this.appSettings.carLength);
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

  setCarLength(value: number) {
    this.appSettings.carLength = value;
    setCarLengthSilent(value);
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

  setRemoteEnabled(value: boolean) {
    this.appSettings.remoteEnabled = value;

    // A server that has never had a token would otherwise come up open to the
    // network on the very first enable.
    if (value && !this.appSettings.remoteToken) {
      this.appSettings.remoteToken = createRemoteToken();
    }
  }

  setRemotePort(value: number) {
    this.appSettings.remotePort = value;
  }

  setRemoteLan(value: boolean) {
    this.appSettings.remoteLan = value;
  }

  setRemoteTelemetryHz(value: number) {
    this.appSettings.remoteTelemetryHz = value;
  }

  /** Invalidates every URL already handed out — which is the point. */
  regenerateRemoteToken() {
    this.appSettings.remoteToken = createRemoteToken();
  }

  clearRemoteToken() {
    this.appSettings.remoteToken = '';
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

  /**
   * Deliberately goes straight to the file instead of through `onSave`: this is
   * the only way out of a locked settings file, so the write gate must not
   * apply to it.
   *
   * The file is deleted rather than emptied. `tauri-plugin-store`'s `clear()`
   * leaves a valid but empty `{}` on disk, which the next start reads as a file
   * that is present and yet holds no settings — the exact signature of a
   * corrupt file, so the reset would lock the app instead of freeing it.
   */
  async resetSettings() {
    await deleteSettingsFile();
    await relaunch();
  }
}
