import { createStoreContext } from '@shared/lib/store-context';
import type { LayoutEditorUiStore } from './layout-editor-ui.store';

export const [LayoutEditorUiContext, useLayoutEditorUiStore] =
  createStoreContext<LayoutEditorUiStore>('LayoutEditorUiStore');
