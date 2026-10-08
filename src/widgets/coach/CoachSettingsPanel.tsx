import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { Card } from '@features/widget-settings/Card';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { COACH_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['coach'];

const { Row } = schemaRows(COACH_SETTINGS);

export const CoachSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <>
      <Card title={t('settingsPanels.coach.call')}>
        <div className={styles.fieldGroup}>
          <Row setting="showCallRow" />
        </div>

        <Row setting="showUrgencyBar" dependsOn="showCallRow" />
        <Row setting="showCornerExitCalls" dependsOn="showCallRow" />
        <Row setting="brakeColor" dependsOn="showCallRow" />
        <Row setting="gasColor" dependsOn="showCallRow" />
      </Card>

      <Card title={t('settingsPanels.coach.readouts')}>
        <div className={styles.fieldGroup}>
          <Row setting="showSpeed" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showReferenceLapTime" />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="showTrackCondition" />
        </div>
      </Card>

      <Card title={t('settingsPanels.coach.trace')}>
        <div className={styles.fieldGroup}>
          <Row setting="showTrace" />
        </div>

        <Row setting="traceChannel" dependsOn="showTrace" stacked />
        <Row setting="windowMeters" dependsOn="showTrace" stacked input />
        <Row setting="referenceColor" dependsOn="showTrace" />
        <Row setting="gainColor" dependsOn="showTrace" />
        <Row setting="lossColor" dependsOn="showTrace" />
      </Card>
    </>
  );
});
