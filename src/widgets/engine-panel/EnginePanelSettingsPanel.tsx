import { observer } from 'mobx-react-lite';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { ENGINE_PANEL_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['engine-panel'];

const { Row } = schemaRows(ENGINE_PANEL_SETTINGS);

// In the order the strips draw them, top to bottom.
const CELL_TOGGLES = [
  'showBrakeBias',
  'showBrakeMisc',
  'showTc',
  'showTc2',
  'showAbs',
  'showEngineMap',
  'showEngineBraking',
  'showPeakBrakeBias',
  'showBrakeBiasFine',
  'showDiffEntry',
  'showDiffMiddle',
  'showDiffExit',
  'showAntiRollFront',
  'showAntiRollRear',
  'showOilTemp',
  'showWaterTemp',
  'showOilPress',
  'showVoltage',
] as const;

export const EnginePanelSettingsPanel = observer(() => {
  return (
    <Card group="content">
      <div className={styles.fieldGroup}>
        <Row setting="highlightChanges" />
      </div>

      {CELL_TOGGLES.map((setting) => (
        <div key={setting} className={styles.fieldGroup}>
          <Row setting={setting} />
        </div>
      ))}
    </Card>
  );
});
