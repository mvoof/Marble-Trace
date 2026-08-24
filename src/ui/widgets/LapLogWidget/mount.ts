import type { WidgetMount } from '@ui/widgets/widget-mount';
import { LAP_LOG_MANIFEST } from './manifest';
import { LapLogWidget } from './LapLogWidget';

export const mount: WidgetMount = {
  id: LAP_LOG_MANIFEST.id,
  component: LapLogWidget,
};
