import { observer } from 'mobx-react-lite';
import { Segmented } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { usePanelSettings } from '@features/widget-settings/use-panel-settings';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { G_METER_SETTINGS, type GMeterWidgetSettings } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['g-meter'];

const { Row, useLabels } = schemaRows(G_METER_SETTINGS);

// The scale's members are numbers, read as "<n>G" in every language.
const ScaleRow = observer(() => {
  const [{ scale }, update] = usePanelSettings<GMeterWidgetSettings>('g-meter');
  const { title } = useLabels('scale');

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
        onChange={(value) => update({ scale: value })}
      />
    </div>
  );
});

export const GMeterSettingsPanel = observer(() => {
  return (
    <>
      <Card group="content">
        <Row setting="displayMode" stacked />
        <ScaleRow />
        <Row setting="showRings" />
        <Row setting="showAxes" />
      </Card>

      <Card group="display">
        <Row setting="colorMode" stacked />
      </Card>
    </>
  );
});
