import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented, Slider } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { usePanelSettings } from '@features/widget-settings/use-panel-settings';
import { panelRows } from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { FUEL_SETTINGS, type FuelWidgetSettings } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['fuel'];

const { DependentBlock } = panelRows<FuelWidgetSettings>();
const { Row, useLabels } = schemaRows(FUEL_SETTINGS);
const { barWidth } = FUEL_SETTINGS.shape;

export const FuelSettingsPanel = observer(() => {
  const [settings, update] = usePanelSettings<FuelWidgetSettings>('fuel');
  const { t } = useTranslation('widgets');
  const barWidthLabels = useLabels('barWidth');

  return (
    <>
      <Card title={t('settingsPanels.fuel.analyticsAndWarnings')}>
        <Row setting="showChart" />

        <DependentBlock dependsOn="showChart">
          <Segmented
            block
            value={settings.chartType}
            options={[
              { label: t('settingsPanels.fuel.chartType_bar'), value: 'bar' },
              { label: t('settingsPanels.fuel.chartType_line'), value: 'line' },
            ]}
            onChange={(value) =>
              update({ chartType: value as FuelWidgetSettings['chartType'] })
            }
          />
        </DependentBlock>

        <DependentBlock dependsOn="showChart">
          <span className={styles.fieldLabel}>{barWidthLabels.title}</span>
          <Slider
            min={barWidth.min}
            max={barWidth.max}
            value={settings.barWidth}
            onChange={(value) => update({ barWidth: value })}
            tooltip={{ formatter: (value) => `${value}px` }}
          />
        </DependentBlock>

        <div className={styles.fieldGroup}>
          <Row setting="showNextStopForecast" />
        </div>
      </Card>

      {/* One row per column, each its own block — a card divides its direct
        children, so the switches no longer read as one stacked lump. */}
      <Card title={t('settingsPanels.fuel.statColumns')}>
        <Row setting="showStatLast" />
        <Row setting="showStatAvg10" />
        <Row setting="showStatMin" />
        <Row setting="showStatMax" />
      </Card>
    </>
  );
});
