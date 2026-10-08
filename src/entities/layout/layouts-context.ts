import { createStoreContext } from '@shared/lib/store-context';
import type { LayoutsStore } from './layouts.store';

export const [LayoutsContext, useLayoutsStore] =
  createStoreContext<LayoutsStore>('LayoutsStore');
