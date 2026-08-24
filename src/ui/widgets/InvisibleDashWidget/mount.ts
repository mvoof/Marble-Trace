import type { WidgetMount } from '@ui/widgets/widget-mount';
import { INVISIBLE_DASH_MANIFEST } from './manifest';
import { InvisibleDashWidget } from './InvisibleDashWidget';

export const mount: WidgetMount = {
  id: INVISIBLE_DASH_MANIFEST.id,
  component: InvisibleDashWidget,
};
