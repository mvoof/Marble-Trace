import { createStoreContext } from '@utils/store-context';
import type { BindingsStore } from './bindings.store';

export const [BindingsContext, useBindingsStore] =
  createStoreContext<BindingsStore>('BindingsStore');
