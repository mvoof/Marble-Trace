import type { WidgetMount } from '@ui/widgets/widget-mount';
import { BATTERY_MANIFEST } from './manifest';
import { BatteryWidget } from './BatteryWidget';

export const mount: WidgetMount = {
  id: BATTERY_MANIFEST.id,
  component: BatteryWidget,
};
