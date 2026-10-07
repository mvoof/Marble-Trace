import { createStoreContext } from '@shared/lib/store-context';
import type { BindingsStore } from './bindings.store';

export const [BindingsContext, useBindingsStore] =
  createStoreContext<BindingsStore>('BindingsStore');
