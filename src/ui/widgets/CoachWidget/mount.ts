import type { WidgetMount } from '@ui/widgets/widget-mount';
import { COACH_MANIFEST } from './manifest';
import { CoachWidget } from './CoachWidget';
import { CoachWidgetStores } from './coach-stores';

export const mount: WidgetMount = {
  id: COACH_MANIFEST.id,
  component: CoachWidget,
  store: (context) => new CoachWidgetStores(context),
};
