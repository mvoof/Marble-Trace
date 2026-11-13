import { observer } from 'mobx-react-lite';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { DRS_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['drs'];

const { Row } = schemaRows(DRS_SETTINGS);

export const DrsSettingsPanel = observer(() => {
  return (
    <Card group="behaviour">
      <div className={styles.fieldGroup}>
        <Row setting="hideWhenCarHasNoDrs" />
      </div>

      <div className={styles.fieldGroup}>
        <Row setting="hideWhenUnavailable" />
      </div>
    </Card>
  );
});
