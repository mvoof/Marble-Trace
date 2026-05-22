import { observer } from 'mobx-react-lite';
import { ColorPicker, InputNumber, Segmented } from 'antd';
import {
  LinearMapOrientation,
  LinearMapWidgetSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card, SettingRow } from './shared';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const LinearMapSettingsPanel = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<LinearMapWidgetSettings>('relative-map');

  const update = (partial: Partial<LinearMapWidgetSettings>) => {
    widgetSettings.updateUserSettings('relative-map', {
      ...settings,
      ...partial,
    });
  };

  return (
    <>
      <Card title="Module Layout">
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Orientation</span>
          <Segmented
            block
            value={settings.orientation}
            options={[
              { label: 'Horizontal', value: 'horizontal' },
              { label: 'Vertical', value: 'vertical' },
            ]}
            onChange={(v) => update({ orientation: v as LinearMapOrientation })}
          />
        </div>
      </Card>

      <Card title="Player Marker">
        <div className={styles.fieldGroup}>
          <SettingRow title="Player Dot Color">
            <ColorPicker
              value={settings.playerDotColor}
              onChange={(c) => update({ playerDotColor: c.toHexString() })}
            />
          </SettingRow>

          <span className={styles.fieldLabel}>Dot Radius (px)</span>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.targetDotRadiusPx}
            min={1}
            max={30}
            onChange={(v) => v !== null && update({ targetDotRadiusPx: v })}
          />
        </div>
      </Card>
    </>
  );
});
