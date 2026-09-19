import type { WidgetMount } from '@ui/widgets/widget-mount';
import { DRS_MANIFEST } from './manifest';
import { DrsWidget } from './DrsWidget';

export const mount: WidgetMount = {
  id: DRS_MANIFEST.id,
  component: DrsWidget,
};
