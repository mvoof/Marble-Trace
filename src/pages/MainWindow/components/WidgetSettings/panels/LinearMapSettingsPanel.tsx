import { observer } from 'mobx-react-lite';
import { ColorPicker, InputNumber, Segmented } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import {
  LinearMapOrientation,
  LinearMapWidgetSettings,
} from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

export const LinearMapSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getLinearMapSettings();

  const update = (partial: Partial<LinearMapWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('linear-map', {
      'linear-map': { ...settings, ...partial },
    });
  };

  return (
    <>
      <Card title="Module Layout">
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Orientation</span>
          <Segmented
            block
            value={settings.orientation}
            options={[
              { label: 'Horizontal', value: 'horizontal' },
              { label: 'Vertical', value: 'vertical' },
            ]}
            onChange={(v) => update({ orientation: v as LinearMapOrientation })}
          />
        </div>
      </Card>

      <Card title="Player Marker">
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>Player Dot Color</div>
            </div>
            <ColorPicker
              value={settings.playerDotColor}
              onChange={(c) => update({ playerDotColor: c.toHexString() })}
            />
          </div>

          <span className={styles.fieldLabel}>Dot Radius (px)</span>
          <InputNumber
            style={{ width: '100%' }}
            value={settings.targetDotRadiusPx}
            min={1}
            max={30}
            onChange={(v) => v !== null && update({ targetDotRadiusPx: v })}
          />
        </div>
      </Card>
    </>
  );
});
