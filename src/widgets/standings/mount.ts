import type { WidgetMount } from '@widgets/widget-mount';
import { STANDINGS_MANIFEST } from './manifest';
import { StandingsWidget } from './StandingsWidget';
import { StandingsWidgetStore } from './standings.store';

export const mount: WidgetMount = {
  id: STANDINGS_MANIFEST.id,
  component: StandingsWidget,
  store: (context) => new StandingsWidgetStore(context),
};
