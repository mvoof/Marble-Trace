import { createStoreContext } from '@shared/lib/store-context';
import type { EnvironmentStore } from './environment.store';

export const [EnvironmentContext, useEnvironmentStore] =
  createStoreContext<EnvironmentStore>('EnvironmentStore');
