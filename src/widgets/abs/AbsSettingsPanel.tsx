import { observer } from 'mobx-react-lite';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { ABS_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['abs'];

const { Row } = schemaRows(ABS_SETTINGS);

export const AbsSettingsPanel = observer(() => {
  return (
    <>
      <Card group="content">
        <div className={styles.fieldGroup}>
          <Row setting="showLevel" />
        </div>
      </Card>

      <Card group="behaviour">
        <div className={styles.fieldGroup}>
          <Row setting="hideWhenCarHasNoAbs" />
        </div>
      </Card>
    </>
  );
});
