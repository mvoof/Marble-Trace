import type { WidgetMount } from '@ui/widgets/widget-mount';
import { G_METER_MANIFEST } from './manifest';
import { GMeterWidget } from './GMeterWidget';

export const mount: WidgetMount = {
  id: G_METER_MANIFEST.id,
  component: GMeterWidget,
};
