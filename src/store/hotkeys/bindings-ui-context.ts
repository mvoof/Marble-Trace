import { createStoreContext } from '@utils/store-context';
import type { BindingsUiStore } from './bindings-ui.store';

export const [BindingsUiContext, useBindingsUiStore] =
  createStoreContext<BindingsUiStore>('BindingsUiStore');
