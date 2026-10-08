import { createStoreContext } from '@shared/lib/store-context';
import type { PitServiceWidgetStore } from './pit-service.store';

export const [PitServiceWidgetContext, usePitServiceWidgetStore] =
  createStoreContext<PitServiceWidgetStore>('PitServiceWidgetStore');
