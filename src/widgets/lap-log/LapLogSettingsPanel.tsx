import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { LAP_LOG_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['lap-log'];

const { Row } = schemaRows(LAP_LOG_SETTINGS);

export const LapLogSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.lapLog.moduleParameters')}>
      <Row setting="paceLossBars" />
      <Row setting="bestLapChip" />
      <Row setting="averageFooter" />
    </Card>
  );
});
