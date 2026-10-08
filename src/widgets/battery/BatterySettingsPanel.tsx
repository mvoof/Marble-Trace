import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  BATTERY_SETTINGS,
  type BatteryWidgetSettings,
} from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['battery'];

const { Row } = schemaRows(BATTERY_SETTINGS);

// Compact mode strips the widget to the charge alone, so every other element
// is only drawn outside it.
const isFullView = (settings: BatteryWidgetSettings): boolean =>
  !settings.compactMode;

export const BatterySettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.battery.moduleParameters')}>
      <div className={styles.fieldGroup}>
        <Row setting="compactMode" />
      </div>

      <Row setting="showDeployMode" dependsOn={isFullView} />
      <Row setting="showPower" dependsOn={isFullView} />
      <Row setting="showLapDeploy" dependsOn={isFullView} />
    </Card>
  );
});
