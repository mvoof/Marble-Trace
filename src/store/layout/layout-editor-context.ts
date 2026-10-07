import { createStoreContext } from '@shared/lib/store-context';
import type { LayoutEditorStore } from './layout-editor.store';
import {
  layoutGestureStores,
  type LayoutGestureStores,
} from './layout-gestures';
import { useLayoutsStore } from './layouts-context';
import { useMainLiveWidgetsStore } from './main-live-widgets-context';

export const [LayoutEditorContext, useLayoutEditorStore] =
  createStoreContext<LayoutEditorStore>('LayoutEditorStore');

/**
 * The two sides a layout gesture holds — see `layout-gestures.ts`. Handed out
 * together so a call site spells the coordination once rather than assembling
 * it from two hooks. Main's alone: a gesture writes the layout.
 */
export const useLayoutGestureStores = (): LayoutGestureStores =>
  layoutGestureStores({
    layouts: useLayoutsStore(),
    liveWidgets: useMainLiveWidgetsStore(),
  });
