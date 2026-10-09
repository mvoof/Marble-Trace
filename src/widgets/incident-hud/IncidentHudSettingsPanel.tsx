import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { INCIDENT_HUD_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['incident-hud'];

const { Row } = schemaRows(INCIDENT_HUD_SETTINGS);

export const IncidentHudSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.incidentHud.moduleParameters')}>
      <Row setting="showProjectedSr" />
      <Row setting="srChipMode" dependsOn="showProjectedSr" />
      <Row setting="showPenalties" />
      <Row setting="showCleanCorners" />
    </Card>
  );
});
