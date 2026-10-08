import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented } from 'antd';
import styles from '@features/widget-settings/WidgetSettings.module.scss';
import { Card } from '@features/widget-settings/Card';
import { useWidgetEditor } from '@features/widget-settings/WidgetEditorContext';
import { usePanelWidgetId } from '@features/widget-settings/setting-rows';
import { schemaRows } from '@features/widget-settings/schema-rows';
import {
  ENGINE_PANEL_SETTINGS,
  type EnginePanelWidgetSettings,
} from './settings-schema';

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
  const liveWidgets = useWidgetEditor();
  const panelWidgetId = usePanelWidgetId('engine-panel');
  const { t } = useTranslation('widgets');

  const settings =
    liveWidgets.getSettings<EnginePanelWidgetSettings>(panelWidgetId);

  const update = (partial: Partial<EnginePanelWidgetSettings>) => {
    liveWidgets.updateUserSettings(panelWidgetId, {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title={t('settingsPanels.enginePanel.moduleParameters')}>
      <div className={styles.fieldGroup}>
        <Row setting="highlightChanges" />
      </div>

      <div className={styles.fieldGroup}>
        <Row setting="horizontal" />
      </div>

      {settings.horizontal ? (
        <div className={styles.fieldGroup}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              width: '100%',
            }}
          >
            <div>
              <div className={styles.fieldTitle}>
                {t('settingsPanels.enginePanel.horizontalColumns')}
              </div>
              <div className={styles.fieldDesc}>
                {t('settingsPanels.enginePanel.horizontalColumnsDesc')}
              </div>
            </div>
            <Segmented
              block
              value={settings.horizontalColumns}
              options={[
                {
                  label: t('settingsPanels.enginePanel.cols3'),
                  value: 3,
                },
                {
                  label: t('settingsPanels.enginePanel.cols4'),
                  value: 4,
                },
                {
                  label: t('settingsPanels.enginePanel.maxRow'),
                  value: 8,
                },
              ]}
              onChange={(value) =>
                update({ horizontalColumns: value as number })
              }
            />
          </div>
        </div>
      ) : (
        <div className={styles.fieldGroup}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              width: '100%',
            }}
          >
            <div>
              <div className={styles.fieldTitle}>
                {t('settingsPanels.enginePanel.verticalColumns')}
              </div>
              <div className={styles.fieldDesc}>
                {t('settingsPanels.enginePanel.verticalColumnsDesc')}
              </div>
            </div>
            <Segmented
              block
              value={settings.verticalColumns}
              options={[
                { label: t('settingsPanels.enginePanel.cols1'), value: 1 },
                { label: t('settingsPanels.enginePanel.cols2'), value: 2 },
                { label: t('settingsPanels.enginePanel.cols3'), value: 3 },
                { label: t('settingsPanels.enginePanel.cols4'), value: 4 },
              ]}
              onChange={(value) => update({ verticalColumns: value as number })}
            />
          </div>
        </div>
      )}

      {CELL_TOGGLES.map((setting) => (
        <div key={setting} className={styles.fieldGroup}>
          <Row setting={setting} />
        </div>
      ))}
    </Card>
  );
});
