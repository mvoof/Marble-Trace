import { createStoreContext } from '@shared/lib/store-context';
import type { BindingsUiStore } from './bindings-ui.store';

export const [BindingsUiContext, useBindingsUiStore] =
  createStoreContext<BindingsUiStore>('BindingsUiStore');
