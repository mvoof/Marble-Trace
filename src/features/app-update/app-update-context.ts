import { createStoreContext } from '@shared/lib/store-context';
import type { AppUpdateStore } from './app-update.store';

export const [AppUpdateContext, useAppUpdateStore] =
  createStoreContext<AppUpdateStore>('AppUpdateStore');
