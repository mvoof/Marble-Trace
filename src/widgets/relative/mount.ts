import type { WidgetMount } from '@widgets/widget-mount';
import { RELATIVE_MANIFEST } from './manifest';
import { RelativeWidget } from './RelativeWidget';
import { RelativeWidgetStore } from './relative.store';

export const mount: WidgetMount = {
  id: RELATIVE_MANIFEST.id,
  component: RelativeWidget,
  store: (context) => new RelativeWidgetStore(context),
};
