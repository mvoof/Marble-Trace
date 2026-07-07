import { observer } from 'mobx-react-lite';
import { ColorPicker, Segmented } from 'antd';
import { RpmLightsWidgetSettings, LedShape } from '@/types/widget-settings';
import { Card } from './Card';

import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { useWidgetEditor } from '../WidgetEditorContext';

export const RpmLightsSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();

  const settings =
    widgetSettings.getSettings<RpmLightsWidgetSettings>('rpm-lights');

  const update = (partial: Partial<RpmLightsWidgetSettings>) => {
    widgetSettings.updateUserSettings('rpm-lights', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title="Shift Lights">
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Colors</span>

        <div className={styles.rpmColorGrid}>
          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>Low</span>

            <ColorPicker
              value={settings.rpmColorLow}
              onChange={(color) => update({ rpmColorLow: color.toHexString() })}
            />
          </div>
          <div className={styles.rpmColorLine} />

          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>Mid</span>

            <ColorPicker
              value={settings.rpmColorMid}
              onChange={(color) => update({ rpmColorMid: color.toHexString() })}
            />
          </div>

          <div className={styles.rpmColorLine} />

          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>High</span>

            <ColorPicker
              value={settings.rpmColorHigh}
              onChange={(color) =>
                update({ rpmColorHigh: color.toHexString() })
              }
            />
          </div>

          <div className={styles.rpmColorLine} />

          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>Shift</span>

            <ColorPicker
              value={settings.rpmColorShift}
              onChange={(color) =>
                update({ rpmColorShift: color.toHexString() })
              }
            />
          </div>

          <div className={styles.rpmColorLine} />

          <div className={styles.rpmColorItem}>
            <span className={styles.rpmColorLabel}>Blink</span>

            <ColorPicker
              value={settings.rpmColorLimit}
              onChange={(color) =>
                update({ rpmColorLimit: color.toHexString() })
              }
            />
          </div>
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>LED Shape</span>

        <Segmented
          block
          value={settings.ledShape}
          options={[
            { label: 'Square', value: 'square' },
            { label: 'Circle', value: 'circle' },
            { label: 'Slant', value: 'parallelogram' },
          ]}
          onChange={(value) => update({ ledShape: value as LedShape })}
        />
      </div>
    </Card>
  );
});
