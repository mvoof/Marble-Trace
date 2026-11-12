import { makeAutoObservable } from 'mobx';
import {
  requestDragMode,
  requestInteractMode,
} from '@shared/api/hotkeys.service';
import {
  deleteSettingsFile,
  restoreLastGoodSettings,
} from '@shared/api/settings.service';
import { relaunchApp } from '@shared/api/updater.service';
import { DEFAULT_OVERLAY_UPDATE_HZ } from '@shared/contracts/generated/backend-constants';
import { mergeWithDefaults } from '@shared/lib/deep-merge';
import { detectSystemLanguage } from '@entities/app-settings/system-locale';
import { createRemoteToken } from '@shared/lib/remote-screen';
import i18n from '@/i18n';
import type { AppLanguage, UnitSystem } from '@shared/contracts/domain';
import type {
  ChatCommand,
  ChatCommandsConfig,
  ChatDisplay,
  CompanionApp,
  InteractHotkeyMode,
  OverlayModes,
  VoiceCrewSettings,
} from '@shared/contracts/generated/bindings';
import {
  DEFAULT_PRESSURE_ADJUST_STEP_KPA,
  type FuelAdjustStep,
  type PitStrategy,
} from '@shared/contracts/pit-strategy';
import {
  DEFAULT_FUEL_STRATEGY,
  type FuelStrategy,
} from '@shared/contracts/fuel-strategy';
import type { SettingsLockReason } from '@shared/settings-schema/types';

export const resolveAppLanguage = (language: AppLanguage) =>
  language === 'system' ? detectSystemLanguage() : language;

/** The language the crew speaks; `app` follows the interface. */
export type VoiceLanguage = 'app' | 'ru' | 'en' | 'es' | 'zh';

export type LastGoodRestoreStatus = 'idle' | 'failed' | 'restored';

export const DEFAULT_APP_SETTINGS = {
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
  // How often the overlays are redrawn, in Hz. Every redraw makes DWM compose a
  // frame on the GPU the game draws on, and at 60 Hz that cost iRacing about
  // half its 1% low; 30 gave most of it back (ADR-0009). The backend publishes
  // at this rate, so every widget moves on the same frames.
  overlayUpdateHz: DEFAULT_OVERLAY_UPDATE_HZ,
  // Pit stop strategy (`PitStrategy`). The car's, not a screen's — these used
  // to be widget settings, and the copy on a stream screen was silently ignored.
  pitAutoFuel: false,
  pitAutoTires: false,
  pitAutoTireWearThreshold: 60,
  pitFuelAdjustStep: 1 as FuelAdjustStep,
  pitPressureAdjustStep: DEFAULT_PRESSURE_ADJUST_STEP_KPA,
  // Fuel strategy (`FuelStrategy`). The backend computes fuel once for the
  // car, so these used to be Fuel widget settings of which only one copy counted.
  ...DEFAULT_FUEL_STRATEGY,
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
  /** Viewers' commands in Twitch chat. Off until the streamer turns them on. */
  streamChatCommandsEnabled: false,
  streamChatCommandCooldownSeconds: 10,
  /** The least time between any two replies. */
  streamChatCommandGlobalCooldownSeconds: 2,
  /** `fuel` shows strategy to rivals on the stream, `lastrace` the streamer's
   *  incidents and rating: both wait to be switched on. */
  streamChatCommandSwitches: {
    pos: true,
    gap: true,
    lap: true,
    best: true,
    sof: true,
    car: true,
    info: true,
    weather: true,
    lastrace: false,
    fuel: false,
    commands: true,
  } as Record<ChatCommand, boolean>,
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
  /** Other programs the rig needs running, started and stopped with the app.
   *  App-level for the same reason the wheel range is: a rig runs one set of
   *  them, whichever layout is on screen. */
  companionApps: [] as CompanionApp[],
  /** The voice crew. Off until the user turns it on: it needs downloads. */
  voiceEnabled: false,
  voiceLanguage: 'app' as VoiceLanguage,
  /** A catalog voice id or `custom:<name>`; empty is the language's recommended one. */
  voiceName: '',
  /** cpal device ids; empty is the system default. */
  voiceInputDevice: '',
  voiceOutputDevice: '',
  voiceVolume: 0.8,
  /** Speech rate, 1 = the voice's own pace. */
  voiceSpeed: 1,
  /** Below it a pit command heard by voice is not carried out. */
  voiceConfidence: 0.6,
  /** Where the voice downloads, packs and cache live; empty is the app's own. */
  voiceFolder: '',
};

export type AppSettings = typeof DEFAULT_APP_SETTINGS;

/** Every `voice*` setting; a new one joins by its name alone. */
type VoiceSettingKey = Extract<keyof AppSettings, `voice${string}`>;

export type VoiceSettingsPatch = Partial<Pick<AppSettings, VoiceSettingKey>>;

export const pitStrategyOf = (settings: AppSettings): PitStrategy => ({
  pitAutoFuel: settings.pitAutoFuel,
  pitAutoTires: settings.pitAutoTires,
  pitAutoTireWearThreshold: settings.pitAutoTireWearThreshold,
  pitFuelAdjustStep: settings.pitFuelAdjustStep,
  pitPressureAdjustStep: settings.pitPressureAdjustStep,
});

export const fuelStrategyOf = (settings: AppSettings): FuelStrategy => ({
  fuelPitWarningLaps: settings.fuelPitWarningLaps,
  fuelAvgWindow: settings.fuelAvgWindow,
  fuelCountYellowFlagLaps: settings.fuelCountYellowFlagLaps,
});

/** What the backend's chat commands run with (`set_chat_commands`). */
export const chatCommandsConfigOf = (
  settings: AppSettings,
  display: ChatDisplay
): ChatCommandsConfig => ({
  enabled: settings.streamChatCommandsEnabled,
  cooldownSeconds: settings.streamChatCommandCooldownSeconds,
  globalCooldownSeconds: settings.streamChatCommandGlobalCooldownSeconds,
  commands: (
    Object.keys(settings.streamChatCommandSwitches) as ChatCommand[]
  ).filter((command) => settings.streamChatCommandSwitches[command]),
  display,
});

/** What the backend's voice crew runs with (`configure_voice_crew`). */
export const voiceCrewSettingsOf = (
  settings: AppSettings,
  unitSystem: UnitSystem
): VoiceCrewSettings => {
  const language =
    settings.voiceLanguage === 'app'
      ? resolveAppLanguage(settings.language)
      : settings.voiceLanguage;

  return {
    enabled: settings.voiceEnabled,
    language,
    voice: settings.voiceName,
    inputDevice: settings.voiceInputDevice || null,
    outputDevice: settings.voiceOutputDevice || null,
    volume: settings.voiceVolume,
    speed: settings.voiceSpeed,
    confidenceThreshold: settings.voiceConfidence,
    folder: settings.voiceFolder,
    imperial: unitSystem === 'imperial',
  };
};

export class AppSettingsStore {
  // The spread is shallow, so the one array among the defaults has to be copied
  // by hand — a store that pushed into it would be editing the defaults, and
  // every other store built from them.
  appSettings: AppSettings = {
    ...DEFAULT_APP_SETTINGS,
    companionApps: [...DEFAULT_APP_SETTINGS.companionApps],
  };

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

  /**
   * When `settings.last-good.json` was written, in epoch milliseconds — the
   * copy a corrupt lock can restore. `null` when there is none, or when the
   * settings are not locked as corrupt.
   */
  lastGoodSettingsSavedAt: number | null = null;

  /**
   * How the last restore of the last-good copy went. `restored` means the file
   * is back on disk but the relaunch failed: the session stays locked — its
   * defaults must not be saved over the restored file — and the user restarts.
   */
  lastGoodRestoreStatus: LastGoodRestoreStatus = 'idle';

  /**
   * The overlay's mouse modes. Owned by the hotkey dispatcher in the backend —
   * their keys fire there — and mirrored here from `app://overlay-modes`
   * (`applyOverlayModes`). A setter asks the dispatcher; it never writes these.
   */
  dragMode = false;
  interactMode = false;

  /**
   * Whether widgets are hidden while the car is off track. A client's copy:
   * main derives it from `autoSwitchLayouts` and the garage layout and sends
   * it in the snapshot, so an overlay needs neither. The default is what those
   * two default to — auto-switch on, no garage layout.
   */
  hidesOffTrack = true;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  lockSettings(reason: SettingsLockReason) {
    this.settingsLocked = true;
    this.settingsLockReason = reason;
  }

  setLastGoodSettingsSavedAt(savedAt: number | null) {
    this.lastGoodSettingsSavedAt = savedAt;
  }

  setLastGoodRestoreStatus(status: LastGoodRestoreStatus) {
    this.lastGoodRestoreStatus = status;
  }

  applySettings(saved: Partial<AppSettings>) {
    const merged = mergeWithDefaults(DEFAULT_APP_SETTINGS, saved);
    Object.assign(this.appSettings, merged);

    void i18n.changeLanguage(resolveAppLanguage(this.appSettings.language));
  }

  /**
   * The one way to change a stored setting. Saving asks nothing of the caller:
   * the save reaction watches the settings themselves.
   */
  update(patch: Partial<AppSettings>) {
    Object.assign(this.appSettings, patch);
  }

  /** One chat command switched on or off. */
  setStreamChatCommandSwitch(command: ChatCommand, value: boolean) {
    this.update({
      streamChatCommandSwitches: {
        ...this.appSettings.streamChatCommandSwitches,
        [command]: value,
      },
    });
  }

  setLanguage(value: AppLanguage) {
    this.appSettings.language = value;
    void i18n.changeLanguage(resolveAppLanguage(value));
  }

  toggleDragMode() {
    this.setDragMode(!this.dragMode);
  }

  toggleHideAllWidgets() {
    this.appSettings.hideAllWidgets = !this.appSettings.hideAllWidgets;
  }

  /**
   * Drag and interact both grab the mouse, but fight over it, so only one may
   * be on — the dispatcher enforces that, and runs the watchdog that switches
   * interact mode back off.
   */
  setDragMode(value: boolean) {
    requestDragMode(value).catch((error: unknown) =>
      console.error('[app-settings] drag mode request failed', error)
    );
  }

  toggleInteractMode() {
    this.setInteractMode(!this.interactMode);
  }

  setInteractMode(value: boolean) {
    requestInteractMode(value).catch((error: unknown) =>
      console.error('[app-settings] interact mode request failed', error)
    );
  }

  /** The dispatcher's broadcast. Assigned directly: this is a mirror. */
  applyOverlayModes(modes: OverlayModes) {
    this.dragMode = modes.dragMode;
    this.interactMode = modes.interactMode;
  }

  setStreamChatTwitchLogin(login: string | null) {
    this.appSettings.streamChatTwitchLogin = login;
    this.appSettings.streamChatAuthRevision += 1;
  }

  setRemoteEnabled(value: boolean) {
    this.appSettings.remoteEnabled = value;

    // A server that has never had a token would otherwise come up open to the
    // network on the very first enable.
    if (value && !this.appSettings.remoteToken) {
      this.appSettings.remoteToken = createRemoteToken();
    }
  }

  /** Invalidates every URL already handed out — which is the point. */
  regenerateRemoteToken() {
    this.appSettings.remoteToken = createRemoteToken();
  }

  clearRemoteToken() {
    this.appSettings.remoteToken = '';
  }

  /**
   * Deliberately goes straight to the file instead of through `onSave`: this is
   * the only way out of a locked settings file, so the write gate must not
   * apply to it.
   *
   * The file is deleted rather than emptied: an empty or `{}` file is present
   * and yet holds no settings — the exact signature of a corrupt file, so the
   * reset would lock the app instead of freeing it.
   */
  async resetSettings() {
    await deleteSettingsFile();
    await relaunchApp();
  }

  /**
   * The other way out of a corrupt lock: put the last-good copy back and start
   * again, so it is read like any other file — migrations included. The
   * unreadable file is kept aside rather than deleted.
   *
   * A failed restore leaves the files as they were and stays on this window,
   * flagged for the banner, instead of relaunching into the same lock. A
   * restore whose relaunch fails has already moved the copy, so the banner
   * drops its actions and asks for a manual restart.
   */
  async restoreLastGoodSettings() {
    this.setLastGoodRestoreStatus('idle');

    try {
      await restoreLastGoodSettings();
    } catch (error) {
      console.error('Failed to restore the last good settings:', error);
      this.setLastGoodRestoreStatus('failed');

      return;
    }

    try {
      await relaunchApp();
    } catch (error) {
      console.error('Settings restored, but the relaunch failed:', error);
      this.setLastGoodSettingsSavedAt(null);
      this.setLastGoodRestoreStatus('restored');
    }
  }
}
