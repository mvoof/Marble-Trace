import { createStoreContext } from '@shared/lib/store-context';
import type { LayoutToastStore } from './layout-toast.store';

export const [LayoutToastContext, useLayoutToastStore] =
  createStoreContext<LayoutToastStore>('LayoutToastStore');
