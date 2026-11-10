import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { ENGINE_PANEL_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['engine-panel'];

const { Row } = schemaRows(ENGINE_PANEL_SETTINGS);

// In the order the panel lists them, which is not the order the cells draw in.
const CELL_TOGGLES = [
  'showOilTemp',
  'showWaterTemp',
  'showOilPress',
  'showVoltage',
  'showAbs',
  'showTc',
  'showBrakeBias',
  'showEngineMap',
  'showTc2',
  'showEngineBraking',
  'showBrakeBiasFine',
  'showPeakBrakeBias',
  'showDiffEntry',
  'showDiffMiddle',
  'showAntiRollFront',
  'showAntiRollRear',
  'showBrakeMisc',
  'showDiffExit',
] as const;

export const EnginePanelSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.enginePanel.moduleParameters')}>
      <div className={styles.fieldGroup}>
        <Row setting="highlightChanges" />
      </div>

      <div className={styles.fieldGroup}>
        <Row setting="horizontal" />
      </div>

      <div className={styles.fieldGroup}>
        <Row setting="horizontalRows" dependsOn="horizontal" stacked />
      </div>

      {CELL_TOGGLES.map((setting) => (
        <div key={setting} className={styles.fieldGroup}>
          <Row setting={setting} />
        </div>
      ))}
    </Card>
  );
});
