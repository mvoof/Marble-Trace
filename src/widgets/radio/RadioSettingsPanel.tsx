import { observer } from 'mobx-react-lite';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { RADIO_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['radio'];

const { Row } = schemaRows(RADIO_SETTINGS);

export const RadioSettingsPanel = observer(() => {
  return (
    <>
      <Card group="content">
        <div className={styles.fieldGroup}>
          <Row setting="nameFormat" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showChannel" />
        </div>
      </Card>

      <Card group="behaviour">
        <div className={styles.fieldGroup}>
          <Row setting="showOnRetune" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="idleShowsChannel" />
        </div>
      </Card>
    </>
  );
});
