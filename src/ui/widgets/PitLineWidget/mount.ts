import type { WidgetMount } from '@ui/widgets/widget-mount';
import { PIT_LINE_MANIFEST } from './manifest';
import { PitLineWidget } from './PitLineWidget';

export const mount: WidgetMount = {
  id: PIT_LINE_MANIFEST.id,
  component: PitLineWidget,
};
