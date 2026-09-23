import type { WidgetMount } from '@ui/widgets/widget-mount';
import { WHEEL_TO_WHEEL_MANIFEST } from './manifest';
import { WheelToWheelWidget } from './WheelToWheelWidget';

export const mount: WidgetMount = {
  id: WHEEL_TO_WHEEL_MANIFEST.id,
  component: WheelToWheelWidget,
};
