import type { WidgetMount } from '@ui/widgets/widget-mount';
import { RELATIVE_MANIFEST } from './manifest';
import { RelativeWidget } from './RelativeWidget';

export const mount: WidgetMount = {
  id: RELATIVE_MANIFEST.id,
  component: RelativeWidget,
};
