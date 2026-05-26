import { observer } from 'mobx-react-lite';
import { Segmented, Slider, Switch } from 'antd';
import type {
  LapDeltaReference,
  DeltaWidgetSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card, DELTA_REFERENCE_DESC } from './shared';
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
              { label: 'PB', value: 'personal_best' },
              { label: 'PO', value: 'personal_optimal' },
              { label: 'SB', value: 'session_best' },
              { label: 'SO', value: 'session_optimal' },
              { label: 'SL', value: 'session_last' },
            ]}
            onChange={(value) =>
              update({ reference: value as LapDeltaReference })
            }
          />
          <div className={styles.fieldDesc} style={{ marginTop: 8 }}>
            {DELTA_REFERENCE_DESC[settings.reference]}
          </div>
        </div>
      </Card>

      <Card title="Visibility">
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>
              Hide when no reference lap
            </span>
            <Switch
              checked={settings.hideWhenNoReference}
              onChange={(value) => update({ hideWhenNoReference: value })}
            />
          </div>
        </div>
      </Card>

      <Card title="Lap Completed Card">
        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <span className={styles.fieldLabel}>Show after lap</span>
            <Switch
              checked={settings.showLapFlash}
              onChange={(value) => update({ showLapFlash: value })}
            />
          </div>
        </div>

        {settings.showLapFlash && (
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
