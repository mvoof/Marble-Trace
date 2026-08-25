import type { WidgetMount } from '@ui/widgets/widget-mount';
import { PIT_SERVICE_MANIFEST } from './manifest';
import { PitServiceWidget } from './PitServiceWidget';

export const mount: WidgetMount = {
  id: PIT_SERVICE_MANIFEST.id,
  component: PitServiceWidget,
};
