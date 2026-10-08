import type { WidgetMount } from '@widgets/widget-mount';
import { PROXIMITY_RADAR_MANIFEST } from './manifest';
import { ProximityRadarWidget } from './ProximityRadarWidget';

export const mount: WidgetMount = {
  id: PROXIMITY_RADAR_MANIFEST.id,
  component: ProximityRadarWidget,
  sharedStores: ['radar'],
};
