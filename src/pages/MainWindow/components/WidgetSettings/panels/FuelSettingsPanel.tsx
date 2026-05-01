import { observer } from 'mobx-react-lite';
import { InputNumber, Segmented, Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import { FuelWidgetSettings } from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

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
        <div
          className={styles.fieldRow}
          style={{ marginBottom: settings.showChart ? 16 : 0 }}
        >
          <div className={styles.fieldTexts}>
            <div className={styles.fieldTitle}>History Chart</div>
            <div className={styles.fieldDesc}>Visual consumption history.</div>
          </div>
          <Switch
            checked={settings.showChart}
            onChange={(v) => update({ showChart: v })}
          />
        </div>
        {settings.showChart && (
          <Segmented
            block
            value={settings.chartType}
            options={[
              { label: 'Bar Chart', value: 'bar' },
              { label: 'Line Chart', value: 'line' },
            ]}
            onChange={(v) => update({ chartType: v as 'bar' | 'line' })}
          />
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
