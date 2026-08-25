import type { WidgetMount } from '@ui/widgets/widget-mount';
import { STANDINGS_MANIFEST } from './manifest';
import { StandingsWidget } from './StandingsWidget';

export const mount: WidgetMount = {
  id: STANDINGS_MANIFEST.id,
  component: StandingsWidget,
};
