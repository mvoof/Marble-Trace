import { createStoreContext } from '@shared/lib/store-context';
import type { CompanionAppsStore } from './companion-apps.store';

export const [CompanionAppsContext, useCompanionAppsStore] =
  createStoreContext<CompanionAppsStore>('CompanionAppsStore');
