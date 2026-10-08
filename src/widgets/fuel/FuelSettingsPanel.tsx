import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { InputNumber, Segmented, Slider } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import {
  panelRows,
  usePanelWidgetId,
} from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { FUEL_SETTINGS, type FuelWidgetSettings } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['fuel'];

const { DependentBlock } = panelRows<FuelWidgetSettings>();
const { Row, useLabels } = schemaRows(FUEL_SETTINGS);
const { barWidth, pitWarningLaps, fuelAvgWindow } = FUEL_SETTINGS.shape;

export const FuelSettingsPanel = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('fuel');
  const { t } = useTranslation('widgets');
  const barWidthLabels = useLabels('barWidth');
  const pitWarningLabels = useLabels('pitWarningLaps');
  const avgWindowLabels = useLabels('fuelAvgWindow');

  const settings = liveWidgets.getSettings<FuelWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<FuelWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

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

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>{pitWarningLabels.title}</span>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.pitWarningLaps}
            min={pitWarningLaps.min}
            max={pitWarningLaps.max}
            onChange={(value) =>
              value !== null && update({ pitWarningLaps: value })
            }
          />
        </div>

        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>{avgWindowLabels.title}</span>
          <div className={styles.fieldDesc} style={{ marginBottom: 8 }}>
            {avgWindowLabels.desc}
          </div>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.fuelAvgWindow}
            min={fuelAvgWindow.min}
            max={fuelAvgWindow.max}
            step={1}
            precision={0}
            parser={(value) =>
              Number.parseInt(value ?? '', 10) || fuelAvgWindow.min
            }
            onChange={(value) =>
              value !== null && update({ fuelAvgWindow: Math.round(value) })
            }
          />
        </div>

        <div className={styles.fieldGroup}>
          <Row setting="countYellowFlagLaps" />
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
