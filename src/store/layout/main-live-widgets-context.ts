import { createStoreContext } from '@utils/store-context';
import type { LiveWidgetsStore } from './live-widgets.store';

/**
 * The widget store with its writes. Only main provides it: main is the one
 * window that writes the settings.
 */
export const [MainLiveWidgetsContext, useMainLiveWidgetsStore] =
  createStoreContext<LiveWidgetsStore>('LiveWidgetsStore');
