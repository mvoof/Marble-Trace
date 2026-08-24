import type { WidgetMount } from '@ui/widgets/widget-mount';
import { RADAR_BAR_MANIFEST } from './manifest';
import { RadarBarWidget } from './RadarBarWidget';

export const mount: WidgetMount = {
  id: RADAR_BAR_MANIFEST.id,
  component: RadarBarWidget,
};
