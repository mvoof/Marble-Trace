import { ActionRegistry } from '@store/hotkeys/action-registry';
import { BindingsStore } from '@store/hotkeys/bindings.store';
import { SettingsPanelUiStore } from '@store/widgets/settings-panel-ui.store';
import { DEFAULT_WIDGETS } from '@store/widget-catalog';

/**
 * What both app windows hold beyond the renderer core, and a remote screen
 * does not: the bindings (main runs them, an overlay names their keys in its
 * banners and is kept current by `bindings-changed`), and the open/closed state
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
