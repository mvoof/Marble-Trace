import { observer } from 'mobx-react-lite';

import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { INCIDENT_TRACKER_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['incident-tracker'];

const { Row } = schemaRows(INCIDENT_TRACKER_SETTINGS);

export const IncidentTrackerSettingsPanel = observer(() => {
  return (
    <Card group="content">
      <Row setting="showProjectedSr" />
      <Row setting="srChipMode" dependsOn="showProjectedSr" />
      <Row setting="showPenalties" />
      <Row setting="showCleanCorners" />
    </Card>
  );
});
