import type { WidgetMount } from '@ui/widgets/widget-mount';
import { COACH_MANIFEST } from './manifest';
import { CoachWidget } from './CoachWidget';

export const mount: WidgetMount = {
  id: COACH_MANIFEST.id,
  component: CoachWidget,
};
