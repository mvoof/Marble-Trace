import { createStoreContext } from '@shared/lib/store-context';
import type { LayoutFilesStore } from './layout-files.store';

export const [LayoutFilesContext, useLayoutFilesStore] =
  createStoreContext<LayoutFilesStore>('LayoutFilesStore');
