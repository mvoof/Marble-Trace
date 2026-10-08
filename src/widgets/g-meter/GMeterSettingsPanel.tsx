import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import { usePanelWidgetId } from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { G_METER_SETTINGS, type GMeterWidgetSettings } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['g-meter'];

const { Row, useLabels } = schemaRows(G_METER_SETTINGS);

// The scale's members are numbers, read as "<n>G" in every language.
const ScaleRow = observer(() => {
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('g-meter');
  const { title } = useLabels('scale');
  const { scale } =
    liveWidgets.getSettings<GMeterWidgetSettings>(panelWidgetId);

  return (
    <div className={styles.fieldGroup}>
      <span className={styles.fieldLabel}>{title}</span>
      <Segmented
        block
        value={scale}
        options={G_METER_SETTINGS.shape.scale.options.map((option) => ({
          label: `${option}G`,
          value: option,
        }))}
        onChange={(value) =>
          liveWidgets.updateUserSettings(panelWidgetId, { scale: value })
        }
      />
    </div>
  );
});

export const GMeterSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.gMeter.moduleParameters')}>
      <Row setting="displayMode" stacked />
      <ScaleRow />
      <Row setting="colorMode" stacked />
    </Card>
  );
});
