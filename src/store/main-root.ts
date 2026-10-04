import { RendererCore } from './renderer-core';
import {
  buildAppWindowStores,
  type AppWindowStores,
} from './app-window-stores';
import type { BindingsStore } from './hotkeys/bindings.store';
import type { SettingsPanelUiStore } from './widgets/settings-panel-ui.store';
import { LayoutEditorStore } from './settings/layout-editor.store';
import { CompanionAppsStore } from './settings/companion-apps.store';
import { TwitchAuthStore } from './settings/twitch-auth.store';
import { DeviceInputStore } from './hotkeys/device-input.store';
import { BindingsUiStore } from './hotkeys/bindings-ui.store';
import { RemoteDevicesStore } from './remote/remote-devices.store';
import { FpsDiagnosticsStore } from './diagnostics/fps-diagnostics.store';
import { DiagnosticsExportStore } from './diagnostics/diagnostics-export.store';
import { TelemetryInspectorStore } from './diagnostics/telemetry-inspector.store';

/**
 * The main window: the renderer core, the app-window stores, and everything
 * only the settings UI uses. It is the one window that writes the settings
 * file, runs the bindings and opens the chat connectors, so the stores those
 * need are built here and nowhere else.
 */
export class MainRoot extends RendererCore implements AppWindowStores {
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
