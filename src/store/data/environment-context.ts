import { createStoreContext } from '@utils/store-context';
import type { EnvironmentStore } from './environment.store';

export const [EnvironmentContext, useEnvironmentStore] =
  createStoreContext<EnvironmentStore>('EnvironmentStore');
