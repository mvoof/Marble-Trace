import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { BatteryWidgetSettings } from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { panelRows } from './setting-rows';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['battery'];

const { SwitchRow } = panelRows<BatteryWidgetSettings>();

export const BatterySettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.battery.moduleParameters')}>
      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="showDeployMode"
          title={t('settingsPanels.battery.deployMode')}
          desc={t('settingsPanels.battery.deployModeDesc')}
        />
      </div>

      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="showPower"
          title={t('settingsPanels.battery.power')}
          desc={t('settingsPanels.battery.powerDesc')}
        />
      </div>

      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="showLapDeploy"
          title={t('settingsPanels.battery.lapDeploy')}
          desc={t('settingsPanels.battery.lapDeployDesc')}
        />
      </div>
    </Card>
  );
});
