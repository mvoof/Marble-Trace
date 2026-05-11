import { observer } from 'mobx-react-lite';
import { InputNumber, Segmented, Slider, Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import { FuelWidgetSettings } from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card, SettingRow } from './shared';

export const FuelSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getFuelSettings();

  const update = (partial: Partial<FuelWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('fuel', {
      fuel: { ...settings, ...partial },
    });
  };

  return (
    <Card title="Analytics & Warnings">
      <div className={styles.fieldGroup}>
        <SettingRow
          title="History Chart"
          desc="Visual consumption history."
          style={{ marginBottom: settings.showChart ? 16 : 0 }}
        >
          <Switch
            checked={settings.showChart}
            onChange={(v) => update({ showChart: v })}
          />
        </SettingRow>
        {settings.showChart && (
          <>
            <Segmented
              block
              value={settings.chartType}
              options={[
                { label: 'Bar Chart', value: 'bar' },
                { label: 'Line Chart', value: 'line' },
              ]}
              onChange={(v) => update({ chartType: v as 'bar' | 'line' })}
              style={{ marginBottom: 16 }}
            />

            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Chart Step Width (px)</span>
              <Slider
                min={5}
                max={20}
                value={settings.barWidth}
                onChange={(v) => update({ barWidth: v })}
                tooltip={{ formatter: (v) => `${v}px` }}
              />
            </div>
          </>
        )}
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>
          Low Fuel Warning Threshold (Laps)
        </span>
        <InputNumber
          style={{ width: '100%' }}
          value={settings.pitWarningLaps}
          min={1}
          max={20}
          onChange={(v) => v !== null && update({ pitWarningLaps: v })}
        />
      </div>
    </Card>
  );
});
