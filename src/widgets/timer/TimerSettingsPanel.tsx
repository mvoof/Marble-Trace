import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { TIMER_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['timer'];

const { Row } = schemaRows(TIMER_SETTINGS);

export const TimerSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.timer.visibleElements')}>
      <div className={styles.fieldGroup}>
        <Row setting="showSessionType" />
      </div>

      <div className={styles.fieldGroup}>
        <Row setting="showLaps" />
      </div>

      <div className={styles.fieldGroup}>
        <Row setting="showPosition" />
      </div>

      <Row setting="useLivePositions" dependsOn="showPosition" />
      <Row setting="classPositionInMulticlass" dependsOn="showPosition" />

      <div className={styles.fieldGroup}>
        <Row setting="showWallClock" />
      </div>

      <div className={styles.fieldGroup}>
        <Row setting="showSimTime" />
      </div>

      <div className={styles.fieldGroup}>
        <Row setting="showPcDate" />
      </div>

      <div className={styles.fieldGroup}>
        <Row setting="showSimDate" />
      </div>
    </Card>
  );
});
