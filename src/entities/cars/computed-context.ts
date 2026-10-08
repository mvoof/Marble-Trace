import { createStoreContext } from '@shared/lib/store-context';
import type { BackendComputedStore } from './computed.store';

export const [BackendComputedContext, useBackendComputedStore] =
  createStoreContext<BackendComputedStore>('BackendComputedStore');
