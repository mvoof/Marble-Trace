import { createStoreContext } from '@utils/store-context';
import type { BackendComputedStore } from './computed.store';

export const [BackendComputedContext, useBackendComputedStore] =
  createStoreContext<BackendComputedStore>('BackendComputedStore');
