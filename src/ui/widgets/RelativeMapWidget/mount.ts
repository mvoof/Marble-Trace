import type { WidgetMount } from '@ui/widgets/widget-mount';
import { RELATIVE_MAP_MANIFEST } from './manifest';
import { RelativeMapWidget } from './RelativeMapWidget';

export const mount: WidgetMount = {
  id: RELATIVE_MAP_MANIFEST.id,
  component: RelativeMapWidget,
};
