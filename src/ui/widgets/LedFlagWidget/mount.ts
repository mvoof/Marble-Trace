import type { WidgetMount } from '@ui/widgets/widget-mount';
import { LED_FLAGS_MANIFEST } from './manifest';
import { LedFlagWidget } from './LedFlagWidget';

export const mount: WidgetMount = {
  id: LED_FLAGS_MANIFEST.id,
  component: LedFlagWidget,
};
