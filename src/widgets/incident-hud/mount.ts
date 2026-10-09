import type { WidgetMount } from '@widgets/widget-mount';
import { INCIDENT_HUD_MANIFEST } from './manifest';
import { IncidentHudWidget } from './IncidentHudWidget';
import { IncidentHudWidgetStore } from './incident-hud.store';

export const mount: WidgetMount = {
  id: INCIDENT_HUD_MANIFEST.id,
  component: IncidentHudWidget,
  store: (context) => new IncidentHudWidgetStore(context),
};
