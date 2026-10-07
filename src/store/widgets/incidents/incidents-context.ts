import { createStoreContext } from '@utils/store-context';
import type { IncidentsWidgetStore } from './incidents.store';

export const [IncidentsWidgetContext, useIncidentsWidgetStore] =
  createStoreContext<IncidentsWidgetStore>('IncidentsWidgetStore');
