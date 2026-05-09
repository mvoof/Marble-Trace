import { observer } from 'mobx-react-lite';
import { ColorPicker, Segmented, Space, Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import {
  InputTraceBarMode,
  InputTraceSettings,
} from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card, SettingRow } from './shared';

export const InputTraceSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getInputTraceSettings();

  const update = (partial: Partial<InputTraceSettings>) => {
    widgetSettingsStore.updateCustomSettings('input-trace', {
      'input-trace': { ...settings, ...partial },
    });
  };

  return (
    <Card title="Data Channels">
      <div className={styles.fieldGroup}>
        <SettingRow title="Throttle" desc="Show throttle trace on the graph.">
          <Space>
            <ColorPicker
              value={settings.throttleColor}
              onChange={(c) => update({ throttleColor: c.toHexString() })}
            />
            <Switch
              checked={settings.showThrottle}
              onChange={(v) => update({ showThrottle: v })}
            />
          </Space>
        </SettingRow>
      </div>

      <div className={styles.fieldGroup}>
        <SettingRow title="Brake" desc="Show brake trace on the graph.">
          <Space>
            <ColorPicker
              value={settings.brakeColor}
              onChange={(c) => update({ brakeColor: c.toHexString() })}
            />
            <Switch
              checked={settings.showBrake}
              onChange={(v) => update({ showBrake: v })}
            />
          </Space>
        </SettingRow>
      </div>

      <div className={styles.fieldGroup}>
        <SettingRow title="Clutch" desc="Show clutch trace on the graph.">
          <Space>
            <ColorPicker
              value={settings.clutchColor}
              onChange={(c) => update({ clutchColor: c.toHexString() })}
            />
            <Switch
              checked={settings.showClutch}
              onChange={(v) => update({ showClutch: v })}
            />
          </Space>
        </SettingRow>
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Progress Bars Orientation</span>
        <Segmented
          block
          value={settings.barMode}
          options={[
            { label: 'Horizontal', value: 'horizontal' },
            { label: 'Vertical', value: 'vertical' },
            { label: 'Hidden', value: 'hidden' },
          ]}
          onChange={(v) => update({ barMode: v as InputTraceBarMode })}
        />
      </div>
    </Card>
  );
});
