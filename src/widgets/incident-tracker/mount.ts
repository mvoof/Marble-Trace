import type { WidgetMount } from '@widgets/widget-mount';
import { INCIDENT_TRACKER_MANIFEST } from './manifest';
import { IncidentTrackerWidget } from './IncidentTrackerWidget';
import { IncidentTrackerWidgetStore } from './incident-tracker.store';

export const mount: WidgetMount = {
  id: INCIDENT_TRACKER_MANIFEST.id,
  component: IncidentTrackerWidget,
  store: (context) => new IncidentTrackerWidgetStore(context),
};
