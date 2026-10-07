import { createStoreContext } from '@utils/store-context';
import type { WidgetAutoHideStore } from './widget-auto-hide.store';

export const [WidgetAutoHideContext, useWidgetAutoHideStore] =
  createStoreContext<WidgetAutoHideStore>('WidgetAutoHideStore');
