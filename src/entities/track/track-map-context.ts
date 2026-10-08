import { createStoreContext } from '@shared/lib/store-context';
import type { TrackMapWidgetStore } from './track-map.store';

export const [TrackMapWidgetContext, useTrackMapWidgetStore] =
  createStoreContext<TrackMapWidgetStore>('TrackMapWidgetStore');
