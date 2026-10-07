import { createStoreContext } from '@utils/store-context';
import type { LiveWidgetsView } from './live-widgets.store';

export const [LiveWidgetsContext, useLiveWidgetsStore] =
  createStoreContext<LiveWidgetsView>('LiveWidgetsView');
