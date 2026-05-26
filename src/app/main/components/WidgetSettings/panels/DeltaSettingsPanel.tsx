import { observer } from 'mobx-react-lite';
import { Segmented, Slider } from 'antd';
import type {
  LapDeltaReference,
  DeltaWidgetSettings,
  LapTimePosition,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './shared';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const DeltaSettingsPanel = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const settings = widgetSettings.getSettings<DeltaWidgetSettings>('delta');

  const update = (partial: Partial<DeltaWidgetSettings>) => {
    widgetSettings.updateUserSettings('delta', { ...settings, ...partial });
  };

  return (
    <>
      <Card title="Delta Reference">
        <div className={styles.fieldGroup}>
          <Segmented
            block
            value={settings.reference}
            options={[
              { label: 'Personal Best', value: 'personal_best' },
              { label: 'Session Best', value: 'session_best' },
            ]}
            onChange={(value) =>
              update({ reference: value as LapDeltaReference })
            }
          />
          <div className={styles.fieldDesc} style={{ marginTop: 8 }}>
            Personal Best uses your fastest completed lap. Session Best uses
            iRacing native live delta.
          </div>
        </div>
      </Card>

      <Card title="Lap Completed Card">
        <div className={styles.fieldGroup}>
          <Segmented
            block
            value={settings.lapTimePosition}
            options={[
              { label: 'Off', value: 'none' },
              { label: 'Top', value: 'top' },
              { label: 'Bottom', value: 'bottom' },
              { label: 'Left', value: 'left' },
              { label: 'Right', value: 'right' },
            ]}
            onChange={(value) =>
              update({ lapTimePosition: value as LapTimePosition })
            }
          />
          <div className={styles.fieldDesc} style={{ marginTop: 8 }}>
            Show lap time card after completing a lap. Position is relative to
            the delta widget.
          </div>
        </div>

        {settings.lapTimePosition !== 'none' && (
          <div className={styles.fieldGroup}>
            <div className={styles.fieldLabel}>
              Display duration: {settings.flashDuration}s
            </div>
            <Slider
              min={3}
              max={10}
              step={1}
              value={settings.flashDuration}
              onChange={(value) => update({ flashDuration: value })}
            />
          </div>
        )}
      </Card>
    </>
  );
});
