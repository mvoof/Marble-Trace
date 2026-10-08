import { createStoreContext } from '@shared/lib/store-context';
import type { IncidentsWidgetStore } from './incidents.store';

export const [IncidentsWidgetContext, useIncidentsWidgetStore] =
  createStoreContext<IncidentsWidgetStore>('IncidentsWidgetStore');
