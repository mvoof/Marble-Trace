import { RendererCore } from './renderer-core';
import {
  buildAppWindowStores,
  type AppWindowStores,
} from './app-window-stores';
import type { BindingsStore } from './hotkeys/bindings.store';
import type { SettingsPanelUiStore } from './widgets/settings-panel-ui.store';

/**
 * An overlay window: the renderer core plus the two stores every app window
 * holds. Nothing of the settings UI — no editor, no inspector, no chat sign-in,
 * no device list. `overlay-root.test.ts` holds it to that.
 */
export class OverlayRoot extends RendererCore implements AppWindowStores {
  bindings: BindingsStore;
  settingsPanelUi: SettingsPanelUiStore;

  constructor(options?: { skipInit?: boolean }) {
    super(options);

    const appWindow = buildAppWindowStores();

    this.bindings = appWindow.bindings;
    this.settingsPanelUi = appWindow.settingsPanelUi;
  }
}
