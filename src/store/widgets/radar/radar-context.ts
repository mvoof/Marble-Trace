import { createStoreContext } from '@utils/store-context';
import type { RadarWidgetStore } from './radar.store';

export const [RadarWidgetContext, useRadarWidgetStore] =
  createStoreContext<RadarWidgetStore>('RadarWidgetStore');
