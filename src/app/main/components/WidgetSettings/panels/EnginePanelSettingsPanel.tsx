import { observer } from 'mobx-react-lite';
import { Switch, Segmented } from 'antd';
import { EnginePanelWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const EnginePanelSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();

  const settings =
    widgetSettings.getSettings<EnginePanelWidgetSettings>('engine-panel');

  const update = (partial: Partial<EnginePanelWidgetSettings>) => {
    widgetSettings.updateUserSettings('engine-panel', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title="Module Parameters">
      <div className={styles.fieldGroup}>
        <SettingRow
          title="Horizontal Layout"
          desc="Align cells horizontally in a single row instead of a vertical grid."
        >
          <Switch
            checked={settings.horizontal}
            onChange={(v) => update({ horizontal: v })}
          />
        </SettingRow>
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
              <div className={styles.fieldTitle}>Horizontal Columns</div>
              <div className={styles.fieldDesc}>
                Number of columns for the horizontal layout (3, 4, or Max).
              </div>
            </div>
            <Segmented
              block
              value={settings.horizontalColumns ?? 8}
              options={[
                { label: '3 Cols', value: 3 },
                { label: '4 Cols', value: 4 },
                { label: 'Max (Row)', value: 8 },
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
              <div className={styles.fieldTitle}>Vertical Columns</div>
              <div className={styles.fieldDesc}>
                Number of columns for the vertical layout (1 to 4).
              </div>
            </div>
            <Segmented
              block
              value={settings.verticalColumns ?? 2}
              options={[
                { label: '1 Col', value: 1 },
                { label: '2 Cols', value: 2 },
                { label: '3 Cols', value: 3 },
                { label: '4 Cols', value: 4 },
              ]}
              onChange={(value) => update({ verticalColumns: value as number })}
            />
          </div>
        </div>
      )}

      {[
        {
          title: 'Oil Temperature',
          desc: 'Show engine oil temperature.',
          value: settings.showOilTemp,
          key: 'showOilTemp',
        },
        {
          title: 'Water Temperature',
          desc: 'Show engine water temperature.',
          value: settings.showWaterTemp,
          key: 'showWaterTemp',
        },
        {
          title: 'Oil Pressure',
          desc: 'Show engine oil pressure.',
          value: settings.showOilPress,
          key: 'showOilPress',
        },
        {
          title: 'System Voltage',
          desc: 'Show electrical system voltage.',
          value: settings.showVoltage,
          key: 'showVoltage',
        },
        {
          title: 'ABS Level',
          desc: 'Show ABS setting.',
          value: settings.showAbs,
          key: 'showAbs',
        },
        {
          title: 'Traction Control (TC)',
          desc: 'Show traction control setting.',
          value: settings.showTc,
          key: 'showTc',
        },
        {
          title: 'Brake Bias',
          desc: 'Show active brake bias.',
          value: settings.showBrakeBias,
          key: 'showBrakeBias',
        },
        {
          title: 'Engine Map',
          desc: 'Show throttle map / engine map.',
          value: settings.showEngineMap,
          key: 'showEngineMap',
        },
      ].map((item) => (
        <div key={item.key} className={styles.fieldGroup}>
          <SettingRow title={item.title} desc={item.desc}>
            <Switch
              checked={item.value}
              onChange={(v) =>
                update({ [item.key as keyof EnginePanelWidgetSettings]: v })
              }
            />
          </SettingRow>
        </div>
      ))}
    </Card>
  );
});
