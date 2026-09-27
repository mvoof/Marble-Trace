import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { TimerWidgetSettings } from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { panelRows } from './setting-rows';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['timer'];

const { SwitchRow } = panelRows<TimerWidgetSettings>();

export const TimerSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.timer.visibleElements')}>
      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="showSessionType"
          title={t('settingsPanels.timer.showSessionType')}
          desc={t('settingsPanels.timer.showSessionTypeDesc')}
        />
      </div>

      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="showLaps"
          title={t('settingsPanels.timer.showLapCount')}
          desc={t('settingsPanels.timer.showLapCountDesc')}
        />
      </div>

      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="showPosition"
          title={t('settingsPanels.timer.showPosition')}
          desc={t('settingsPanels.timer.showPositionDesc')}
        />
      </div>

      <SwitchRow
        settingKey="useLivePositions"
        dependsOn="showPosition"
        title={t('settingsPanels.common.useLivePositions')}
        desc={t('settingsPanels.common.useLivePositionsDesc')}
      />

      <SwitchRow
        settingKey="classPositionInMulticlass"
        dependsOn="showPosition"
        title={t('settingsPanels.common.classPositionInMulticlass')}
        desc={t('settingsPanels.common.classPositionInMulticlassDesc')}
      />

      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="showWallClock"
          title={t('settingsPanels.timer.showPcClock')}
          desc={t('settingsPanels.timer.showPcClockDesc')}
        />
      </div>

      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="showSimTime"
          title={t('settingsPanels.timer.showSimTime')}
          desc={t('settingsPanels.timer.showSimTimeDesc')}
        />
      </div>

      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="showPcDate"
          title={t('settingsPanels.timer.showPcDate')}
          desc={t('settingsPanels.timer.showPcDateDesc')}
        />
      </div>

      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="showSimDate"
          title={t('settingsPanels.timer.showSimDate')}
          desc={t('settingsPanels.timer.showSimDateDesc')}
        />
      </div>
    </Card>
  );
});
