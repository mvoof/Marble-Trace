import { createStoreContext } from '@utils/store-context';
import type { TrackMapWidgetStore } from './track-map.store';

export const [TrackMapWidgetContext, useTrackMapWidgetStore] =
  createStoreContext<TrackMapWidgetStore>('TrackMapWidgetStore');
