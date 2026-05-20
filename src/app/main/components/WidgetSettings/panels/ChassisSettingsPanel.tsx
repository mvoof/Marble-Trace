import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { ChassisWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card, SettingRow } from './shared';

export const ChassisSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getChassisSettings();

  const update = (partial: Partial<ChassisWidgetSettings>) => {
    widgetSettingsStore.updateUserSettings('chassis', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title="Module Layout">
      <div className={styles.fieldGroup}>
        <SettingRow
          title="Suspension & Brakes"
          desc="Show tire pressures, temperatures, and brake bias panels."
        >
          <Switch
            checked={settings.showSuspensionAndBrakes}
            onChange={(v) => update({ showSuspensionAndBrakes: v })}
          />
        </SettingRow>
      </div>
    </Card>
  );
});
