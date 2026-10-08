import { RendererCore } from './renderer-core';
import type { LiveWidgetsStore } from '@entities/layout/live-widgets.store';
import {
  buildAppWindowStores,
  type AppWindowStores,
} from './app-window-stores';
import type { BindingsStore } from '@features/hotkey-bindings/bindings.store';
import type { SettingsPanelUiStore } from '@entities/widget/settings-panel-ui.store';
import { LayoutEditorStore } from '@features/layout-editor/layout-editor.store';
import { CompanionAppsStore } from '@features/companion-apps/companion-apps.store';
import { TwitchAuthStore } from '@features/twitch-auth/twitch-auth.store';
import { DeviceInputStore } from '@features/hotkey-bindings/device-input.store';
import { BindingsUiStore } from '@features/hotkey-bindings/bindings-ui.store';
import { RemoteDevicesStore } from '@features/remote-screens/remote-devices.store';
import { FpsDiagnosticsStore } from '@features/diagnostics/fps-diagnostics.store';
import { DiagnosticsExportStore } from '@features/diagnostics/diagnostics-export.store';
import { TelemetryInspectorStore } from '@features/telemetry-inspector/telemetry-inspector.store';
import { TrackRotationStore } from '@entities/track/track-rotation.store';

/**
 * The main window: the renderer core, the app-window stores, and everything
 * only the settings UI uses. It is the one window that writes the settings
 * file, runs the bindings and opens the chat connectors, so the stores those
 * need are built here and nowhere else.
 */
export class MainRoot extends RendererCore implements AppWindowStores {
  /** Main is the one window that writes the settings. */
  declare liveWidgets: LiveWidgetsStore;
  bindings: BindingsStore;
  settingsPanelUi: SettingsPanelUiStore;
  layoutEditor: LayoutEditorStore;
  companionApps: CompanionAppsStore;
  twitchAuth: TwitchAuthStore;
  deviceInput: DeviceInputStore;
  bindingsUi: BindingsUiStore;
  remoteDevices: RemoteDevicesStore;
  fpsDiagnostics: FpsDiagnosticsStore;
  diagnosticsExport: DiagnosticsExportStore;
  telemetryInspector: TelemetryInspectorStore;
  trackRotation: TrackRotationStore;

  constructor(options?: { skipInit?: boolean }) {
    super(options);

    const appWindow = buildAppWindowStores();

    this.bindings = appWindow.bindings;
    this.settingsPanelUi = appWindow.settingsPanelUi;
    this.layoutEditor = new LayoutEditorStore(this.layouts, this.liveWidgets);
    this.companionApps = new CompanionAppsStore(this);
    this.twitchAuth = new TwitchAuthStore(this);
    this.deviceInput = new DeviceInputStore();
    this.bindingsUi = new BindingsUiStore();
    this.remoteDevices = new RemoteDevicesStore();
    this.fpsDiagnostics = new FpsDiagnosticsStore(this);
    this.telemetryInspector = new TelemetryInspectorStore(this);
    this.diagnosticsExport = new DiagnosticsExportStore(this);
    this.trackRotation = new TrackRotationStore();

    if (!options?.skipInit) {
      void this.twitchAuth.init();
    }
  }

  override dispose() {
    this.fpsDiagnostics.dispose();
    this.twitchAuth.dispose();
    this.companionApps.dispose();
    super.dispose();
  }
}
