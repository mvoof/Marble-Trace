import { createStoreContext } from '@shared/lib/store-context';
import type { LiveWidgetsView } from './live-widgets.store';

export const [LiveWidgetsContext, useLiveWidgetsStore] =
  createStoreContext<LiveWidgetsView>('LiveWidgetsView');
