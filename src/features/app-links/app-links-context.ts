import { createStoreContext } from '@shared/lib/store-context';
import type { AppLinksStore } from './app-links.store';

export const [AppLinksContext, useAppLinksStore] =
  createStoreContext<AppLinksStore>('AppLinksStore');
