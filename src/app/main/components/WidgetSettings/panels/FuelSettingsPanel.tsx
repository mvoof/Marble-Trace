import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Segmented, Slider, Switch } from 'antd';
import { FuelWidgetSettings } from '@/types/widget-settings';
import {
  FUEL_AVG_WINDOW_ALL_LAPS,
  FUEL_AVG_WINDOW_MAX,
} from '@utils/constants/fuel-constants';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

interface StatColumnRow {
  key: keyof Pick<
    FuelWidgetSettings,
    'showStatLast' | 'showStatAvg10' | 'showStatMin' | 'showStatMax'
  >;
  /** Absent for the average column, whose caption follows the window setting. */
  labelKey?: string;
}

// `showStatAvg10` is a historical key kept as-is because it is persisted in
// user settings — the column itself has not been fixed at ten laps for a while.
const STAT_COLUMN_ROWS: StatColumnRow[] = [
  { key: 'showStatLast', labelKey: 'settingsPanels.fuel.statLast' },
  { key: 'showStatAvg10' },
  { key: 'showStatMin', labelKey: 'settingsPanels.fuel.statMin' },
  { key: 'showStatMax', labelKey: 'settingsPanels.fuel.statMax' },
];

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

  // Quotes the window actually in force instead of a fixed number, so the row
  // cannot promise ten laps while the setting below it says something else.
  const statLabel = (labelKey?: string): string => {
    if (labelKey !== undefined) {
      return t(labelKey);
    }

    if (settings.fuelAvgWindow === FUEL_AVG_WINDOW_ALL_LAPS) {
      return t('settingsPanels.fuel.statAvgAll');
    }

    return t('settingsPanels.fuel.statAvg', { window: settings.fuelAvgWindow });
  };

  return (
    <Card title={t('settingsPanels.fuel.analyticsAndWarnings')}>
      <div className={styles.fieldGroup}>
        <SettingRow
          title={t('settingsPanels.fuel.historyChart')}
          desc={t('settingsPanels.fuel.historyChartDesc')}
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
          <SettingRow key={key} title={statLabel(labelKey)}>
            <Switch
              checked={settings[key]}
              onChange={(v) => update({ [key]: v })}
            />
          </SettingRow>
        ))}
      </div>

      <div className={styles.fieldGroup}>
        <SettingRow
          title={t('settingsPanels.fuel.nextStopForecast')}
          desc={t('settingsPanels.fuel.nextStopForecastDesc')}
        >
          <Switch
            checked={settings.showNextStopForecast}
            onChange={(v) => update({ showNextStopForecast: v })}
          />
        </SettingRow>
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
