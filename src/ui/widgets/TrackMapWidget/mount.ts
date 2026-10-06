import type { WidgetMount } from '@ui/widgets/widget-mount';
import { TRACK_MAP_MANIFEST } from './manifest';
import { TrackMapWidget } from './TrackMapWidget';

export const mount: WidgetMount = {
  id: TRACK_MAP_MANIFEST.id,
  component: TrackMapWidget,
};
