import { observer } from 'mobx-react-lite';
import { ColorPicker, Switch } from 'antd';
import type { DrivingCoachWidgetSettings } from '@/types/widget-settings';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { useWidgetEditor } from '../WidgetEditorContext';

export const DrivingCoachSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();

  const settings =
    widgetSettings.getSettings<DrivingCoachWidgetSettings>('driving-coach');

  const update = (partial: Partial<DrivingCoachWidgetSettings>) => {
    widgetSettings.updateUserSettings('driving-coach', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title="Driving Coach">
      <div className={styles.fieldGroup}>
        <SettingRow
          title="Reference Speed"
          desc="Show your best lap's speed at this point on track, with live delta."
        >
          <Switch
            checked={settings.showReferenceSpeed}
            onChange={(value) => update({ showReferenceSpeed: value })}
          />
        </SettingRow>
      </div>

      <div className={styles.fieldGroup}>
        <SettingRow title="Brake Banner" desc="Background when braking now.">
          <ColorPicker
            value={settings.brakeColor}
            onChange={(color) => update({ brakeColor: color.toRgbString() })}
          />
        </SettingRow>
      </div>

      <div className={styles.fieldGroup}>
        <SettingRow title="Gas Banner" desc="Background when back on throttle.">
          <ColorPicker
            value={settings.gasColor}
            onChange={(color) => update({ gasColor: color.toRgbString() })}
          />
        </SettingRow>
      </div>
    </Card>
  );
});
