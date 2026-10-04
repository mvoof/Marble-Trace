import type { WidgetMount } from '@ui/widgets/widget-mount';
import { RELATIVE_MANIFEST } from './manifest';
import { RelativeWidget } from './RelativeWidget';
import { RelativeWidgetStore } from './relative.widget';

export const mount: WidgetMount = {
  id: RELATIVE_MANIFEST.id,
  component: RelativeWidget,
  store: (context) => new RelativeWidgetStore(context),
  sharedStores: ['paceCar'],
};
