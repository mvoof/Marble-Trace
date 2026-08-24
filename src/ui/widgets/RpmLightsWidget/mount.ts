import type { WidgetMount } from '@ui/widgets/widget-mount';
import { RPM_LIGHTS_MANIFEST } from './manifest';
import { RpmLightsWidget } from './RpmLightsWidget';

export const mount: WidgetMount = {
  id: RPM_LIGHTS_MANIFEST.id,
  component: RpmLightsWidget,
};
