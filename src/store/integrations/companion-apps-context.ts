import { createStoreContext } from '@utils/store-context';
import type { CompanionAppsStore } from './companion-apps.store';

export const [CompanionAppsContext, useCompanionAppsStore] =
  createStoreContext<CompanionAppsStore>('CompanionAppsStore');
