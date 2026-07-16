import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Segmented, Slider, Switch } from 'antd';
import { FuelWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

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
    </Card>
  );
});
