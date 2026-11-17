import { observer } from 'mobx-react-lite';

import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { LAP_LOG_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['lap-log'];

const { Row } = schemaRows(LAP_LOG_SETTINGS);

export const LapLogSettingsPanel = observer(() => {
  return (
    <>
      <Card group="content">
        <Row setting="showDelta" />
        <Row setting="paceLossBars" dependsOn="showDelta" />
        <Row setting="bestLapChip" />
        <Row setting="averageFooter" />
      </Card>

      <Card group="display">
        <Row setting="rowPadding" />
      </Card>
    </>
  );
});
