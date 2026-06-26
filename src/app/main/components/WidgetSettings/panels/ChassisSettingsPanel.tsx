import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import { ChassisWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const ChassisSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();

  const settings = widgetSettings.getSettings<ChassisWidgetSettings>('chassis');

  const update = (partial: Partial<ChassisWidgetSettings>) => {
    widgetSettings.updateUserSettings('chassis', {
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
