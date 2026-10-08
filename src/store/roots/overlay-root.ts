import { RendererCore } from './renderer-core';
import {
  buildAppWindowStores,
  type AppWindowStores,
} from './app-window-stores';
import type { BindingsStore } from '@features/hotkey-bindings/bindings.store';
import { SettingsClientStore } from '@app/sync/settings-client.store';
import type { SettingsPanelUiStore } from '@entities/widget/settings-panel-ui.store';

/**
 * An overlay window: the renderer core plus the two stores every app window
 * holds, and its end of the client protocol. Nothing of the settings UI — no
 * editor, no inspector, no chat sign-in, no device list.
 * `overlay-root.test.ts` holds it to that.
 */
export class OverlayRoot extends RendererCore implements AppWindowStores {
  bindings: BindingsStore;
  settingsPanelUi: SettingsPanelUiStore;
  settingsClient: SettingsClientStore;

  constructor(options?: { skipInit?: boolean }) {
    super(options);

    const appWindow = buildAppWindowStores();

    this.bindings = appWindow.bindings;
    this.settingsPanelUi = appWindow.settingsPanelUi;
    this.settingsClient = new SettingsClientStore(
      this.liveWidgets,
      () => this.layouts.liveLayoutId
    );
  }
}
