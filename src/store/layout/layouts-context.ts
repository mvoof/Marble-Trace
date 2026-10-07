import { createStoreContext } from '@utils/store-context';
import type { LayoutsStore } from './layouts.store';

export const [LayoutsContext, useLayoutsStore] =
  createStoreContext<LayoutsStore>('LayoutsStore');
