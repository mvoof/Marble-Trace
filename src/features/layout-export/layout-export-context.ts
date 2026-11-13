import { createStoreContext } from '@shared/lib/store-context';
import type { LayoutExportStore } from './layout-export.store';

export const [LayoutExportContext, useLayoutExportStore] =
  createStoreContext<LayoutExportStore>('LayoutExportStore');
