import { createStoreContext } from '@utils/store-context';
import type { AppSettingsStore } from './app-settings.store';

export const [AppSettingsContext, useAppSettingsStore] =
  createStoreContext<AppSettingsStore>('AppSettingsStore');
