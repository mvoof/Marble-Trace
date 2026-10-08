import { createStoreContext } from '@shared/lib/store-context';
import type { UnitsStore } from './units.store';

export const [UnitsContext, useUnitsStore] =
  createStoreContext<UnitsStore>('UnitsStore');
