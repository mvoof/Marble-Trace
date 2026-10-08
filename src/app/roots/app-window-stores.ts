import { ActionRegistry } from '@features/hotkey-bindings/action-registry';
import { BindingsStore } from '@features/hotkey-bindings/bindings.store';
import { SettingsPanelUiStore } from '@entities/widget/settings-panel-ui.store';
import { DEFAULT_WIDGETS } from '@entities/widget/widget-catalog';

/**
 * What both app windows hold beyond the renderer core, and a remote screen
 * does not: the bindings (main runs them, an overlay names their keys in its
 * banners and is kept current by its snapshot), and the open/closed state
 * of the settings panels, which an overlay draws too — in drag mode its popup
 * embeds the same widget panels the main window shows.
 */
export interface AppWindowStores {
  bindings: BindingsStore;
  settingsPanelUi: SettingsPanelUiStore;
}

export const buildAppWindowStores = (): AppWindowStores => ({
  bindings: new BindingsStore(new ActionRegistry(DEFAULT_WIDGETS)),
  settingsPanelUi: new SettingsPanelUiStore(),
});
