import { observer } from 'mobx-react-lite';

import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { WHEEL_TO_WHEEL_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['wheel-to-wheel'];

const { Row } = schemaRows(WHEEL_TO_WHEEL_SETTINGS);

export const WheelToWheelSettingsPanel = observer(() => {
  return (
    <>
      <Card group="content">
        <div className={styles.fieldGroup}>
          <Row setting="layout" />
        </div>
      </Card>

      <Card group="behaviour">
        <div className={styles.fieldGroup}>
          <Row setting="gapThreshold" input />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="hideDelay" input />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="raceOnly" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="includeLapped" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="qualifyingVisibility" />
        </div>
      </Card>
    </>
  );
});
