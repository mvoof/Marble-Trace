import type { WidgetMount } from '@widgets/widget-mount';
import { RADIO_MANIFEST } from './manifest';
import { RadioWidget } from './RadioWidget';

export const mount: WidgetMount = {
  id: RADIO_MANIFEST.id,
  component: RadioWidget,
};
