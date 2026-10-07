import { createStoreContext } from '@utils/store-context';
import type { SimStore } from './sim.store';

export const [SimContext, useSimStore] =
  createStoreContext<SimStore>('SimStore');
