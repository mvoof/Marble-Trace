import type { WidgetMount } from '@ui/widgets/widget-mount';
import { RACE_DASH_MANIFEST } from './manifest';
import { RaceDashWidget } from './RaceDashWidget';

export const mount: WidgetMount = {
  id: RACE_DASH_MANIFEST.id,
  component: RaceDashWidget,
};
