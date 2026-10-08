import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { BatteryWidgetSettings } from '@shared/contracts/widget-settings';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { panelRows } from '@features/widget-settings/setting-rows';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['battery'];

const { SwitchRow } = panelRows<BatteryWidgetSettings>();

// Compact mode strips the widget to the charge alone, so every other element
// is only drawn outside it.
const isFullView = (settings: BatteryWidgetSettings): boolean =>
  !settings.compactMode;

export const BatterySettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.battery.moduleParameters')}>
      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="compactMode"
          title={t('settingsPanels.battery.compactMode')}
          desc={t('settingsPanels.battery.compactModeDesc')}
        />
      </div>

      <SwitchRow
        settingKey="showDeployMode"
        dependsOn={isFullView}
        title={t('settingsPanels.battery.deployMode')}
        desc={t('settingsPanels.battery.deployModeDesc')}
      />

      <SwitchRow
        settingKey="showPower"
        dependsOn={isFullView}
        title={t('settingsPanels.battery.power')}
        desc={t('settingsPanels.battery.powerDesc')}
      />

      <SwitchRow
        settingKey="showLapDeploy"
        dependsOn={isFullView}
        title={t('settingsPanels.battery.lapDeploy')}
        desc={t('settingsPanels.battery.lapDeployDesc')}
      />
    </Card>
  );
});
