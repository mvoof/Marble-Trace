import type { WidgetMount } from '@ui/widgets/widget-mount';
import { PROXIMITY_RADAR_MANIFEST } from './manifest';
import { ProximityRadarWidget } from './ProximityRadarWidget';

export const mount: WidgetMount = {
  id: PROXIMITY_RADAR_MANIFEST.id,
  component: ProximityRadarWidget,
};
