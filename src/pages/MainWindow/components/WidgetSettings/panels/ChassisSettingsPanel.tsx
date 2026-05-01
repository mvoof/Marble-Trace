import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import { ChassisWidgetSettings } from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

export const ChassisSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getChassisSettings();

  const update = (partial: Partial<ChassisWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('chassis', {
      chassis: { ...settings, ...partial },
    });
  };

  return (
    <Card title="Module Layout">
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Show Suspension & Brakes</span>
        <Switch
          checked={settings.showInboard}
          onChange={(v) => update({ showInboard: v })}
        />
      </div>
    </Card>
  );
});
