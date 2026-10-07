import { createStoreContext } from '@shared/lib/store-context';
import type { AppSettingsStore } from './app-settings.store';

export const [AppSettingsContext, useAppSettingsStore] =
  createStoreContext<AppSettingsStore>('AppSettingsStore');
