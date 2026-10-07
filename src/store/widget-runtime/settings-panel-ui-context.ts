import { createStoreContext } from '@shared/lib/store-context';
import type { SettingsPanelUiStore } from './settings-panel-ui.store';

export const [SettingsPanelUiContext, useSettingsPanelUiStore] =
  createStoreContext<SettingsPanelUiStore>('SettingsPanelUiStore');
