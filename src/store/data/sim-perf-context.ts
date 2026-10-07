import { createStoreContext } from '@utils/store-context';
import type { SimPerfStore } from './sim-perf.store';

export const [SimPerfContext, useSimPerfStore] =
  createStoreContext<SimPerfStore>('SimPerfStore');
