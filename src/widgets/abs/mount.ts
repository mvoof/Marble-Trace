import type { WidgetMount } from '@widgets/widget-mount';
import { ABS_MANIFEST } from './manifest';
import { AbsWidget } from './AbsWidget';

export const mount: WidgetMount = {
  id: ABS_MANIFEST.id,
  component: AbsWidget,
};
