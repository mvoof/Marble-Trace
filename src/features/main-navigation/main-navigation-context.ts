import { createStoreContext } from '@shared/lib/store-context';
import type { MainNavigationStore } from './main-navigation.store';

export const [MainNavigationContext, useMainNavigationStore] =
  createStoreContext<MainNavigationStore>('MainNavigationStore');
