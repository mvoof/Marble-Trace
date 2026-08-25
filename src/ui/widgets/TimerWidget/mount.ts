import type { WidgetMount } from '@ui/widgets/widget-mount';
import { TIMER_MANIFEST } from './manifest';
import { TimerWidget } from './TimerWidget';

export const mount: WidgetMount = {
  id: TIMER_MANIFEST.id,
  component: TimerWidget,
};
