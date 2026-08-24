import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Segmented, Slider, Switch } from 'antd';
import { FuelWidgetSettings } from '@/types/widget-settings';
import {
  FUEL_AVG_WINDOW_ALL_LAPS,
  FUEL_AVG_WINDOW_MAX,
} from '@utils/fuel-constants';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';
import { panelRows } from './setting-rows';

interface StatColumnRow {
  key: keyof Pick<
    FuelWidgetSettings,
    'showStatLast' | 'showStatAvg10' | 'showStatMin' | 'showStatMax'
  >;
  labelKey: string;
}

// `showStatAvg10` is a historical key kept as-is because it is persisted in
// user settings — the column averages every recorded lap, not ten of them.
const STAT_COLUMN_ROWS: StatColumnRow[] = [
  { key: 'showStatLast', labelKey: 'settingsPanels.fuel.statLast' },
  { key: 'showStatAvg10', labelKey: 'settingsPanels.fuel.statAvgAll' },
  { key: 'showStatMin', labelKey: 'settingsPanels.fuel.statMin' },
  { key: 'showStatMax', labelKey: 'settingsPanels.fuel.statMax' },
];

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['fuel'];

const { SwitchRow } = panelRows<FuelWidgetSettings>();

export const FuelSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings = widgetSettings.getSettings<FuelWidgetSettings>('fuel');

  const update = (partial: Partial<FuelWidgetSettings>) => {
    widgetSettings.updateUserSettings('fuel', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title={t('settingsPanels.fuel.analyticsAndWarnings')}>
      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="showChart"
          title={t('settingsPanels.fuel.historyChart')}
          desc={t('settingsPanels.fuel.historyChartDesc')}
          style={{ marginBottom: settings.showChart ? 16 : 0 }}
        />
        {settings.showChart && (
          <>
            <Segmented
              block
              value={settings.chartType}
              options={[
                { label: t('settingsPanels.fuel.barChart'), value: 'bar' },
                { label: t('settingsPanels.fuel.lineChart'), value: 'line' },
              ]}
              onChange={(v) => update({ chartType: v as 'bar' | 'line' })}
              style={{ marginBottom: 16 }}
            />

            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>
                {t('settingsPanels.fuel.chartStepWidth')}
              </span>
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
          {t('settingsPanels.fuel.statColumns')}
        </span>
        {STAT_COLUMN_ROWS.map(({ key, labelKey }) => (
          <SettingRow key={key} title={t(labelKey)}>
            <Switch
              checked={settings[key]}
              onChange={(v) => update({ [key]: v })}
            />
          </SettingRow>
        ))}
      </div>

      <div className={styles.fieldGroup}>
        <SwitchRow
          settingKey="showNextStopForecast"
          title={t('settingsPanels.fuel.nextStopForecast')}
          desc={t('settingsPanels.fuel.nextStopForecastDesc')}
        />
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>
          {t('settingsPanels.fuel.lowFuelWarningThreshold')}
        </span>
        <InputNumber
          style={{ width: '100%' }}
          value={settings.pitWarningLaps}
          min={1}
          max={20}
          onChange={(v) => v !== null && update({ pitWarningLaps: v })}
        />
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>
          {t('settingsPanels.fuel.avgWindow')}
        </span>
        <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
          {t('settingsPanels.fuel.avgWindowDesc')}
        </div>
        <InputNumber
          style={{ width: '100%' }}
          value={settings.fuelAvgWindow}
          min={FUEL_AVG_WINDOW_ALL_LAPS}
          max={FUEL_AVG_WINDOW_MAX}
          step={1}
          precision={0}
          parser={(v) =>
            Number.parseInt(v ?? '', 10) || FUEL_AVG_WINDOW_ALL_LAPS
          }
          onChange={(v) =>
            v !== null && update({ fuelAvgWindow: Math.round(v) })
          }
        />
      </div>
    </Card>
  );
});
