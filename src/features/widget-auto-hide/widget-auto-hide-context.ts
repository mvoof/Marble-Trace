import { createStoreContext } from '@shared/lib/store-context';
import type { WidgetAutoHideStore } from './widget-auto-hide.store';

export const [WidgetAutoHideContext, useWidgetAutoHideStore] =
  createStoreContext<WidgetAutoHideStore>('WidgetAutoHideStore');
