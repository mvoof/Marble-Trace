import type { WidgetMount } from '@widgets/widget-mount';
import { RADIO_MANIFEST } from './manifest';
import { RadioWidget } from './RadioWidget';
import { RadioWidgetStore } from './radio.store';

export const mount: WidgetMount = {
  id: RADIO_MANIFEST.id,
  component: RadioWidget,
  store: (context) => new RadioWidgetStore(context),
};
