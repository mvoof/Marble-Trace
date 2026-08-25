import type { WidgetMount } from '@ui/widgets/widget-mount';
import { FLAT_FLAGS_MANIFEST } from './manifest';
import { FlatFlagsWidget } from './FlatFlagsWidget';

export const mount: WidgetMount = {
  id: FLAT_FLAGS_MANIFEST.id,
  component: FlatFlagsWidget,
};
