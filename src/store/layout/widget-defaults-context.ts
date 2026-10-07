import { createStoreContext } from '@utils/store-context';
import type { WidgetDefaultsStore } from './widget-defaults.store';

export const [WidgetDefaultsContext, useWidgetDefaultsStore] =
  createStoreContext<WidgetDefaultsStore>('WidgetDefaultsStore');
