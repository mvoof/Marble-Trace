import { createStoreContext } from '@shared/lib/store-context';
import type { DisplaysStore } from './displays.store';

export const [DisplaysContext, useDisplaysStore] =
  createStoreContext<DisplaysStore>('DisplaysStore');
