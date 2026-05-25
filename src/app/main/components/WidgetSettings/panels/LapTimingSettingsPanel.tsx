import { observer } from 'mobx-react-lite';
import { Segmented, Switch } from 'antd';
import type {
  LapDeltaReference,
  LapTimingWidgetSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card, SettingRow } from './shared';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const LapTimingSettingsPanel = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const settings =
    widgetSettings.getSettings<LapTimingWidgetSettings>('lap-timing');

  const update = (partial: Partial<LapTimingWidgetSettings>) => {
    widgetSettings.updateUserSettings('lap-timing', {
      ...settings,
      ...partial,
    });
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
            Used for sector delta chips and the progress prediction.
          </div>
        </div>
      </Card>

      <Card title="Options">
        <div className={styles.fieldGroup}>
          <SettingRow
            title="Show Predicted Lap"
            desc="Estimated finish time displayed in the header."
          >
            <Switch
              checked={settings.showPredicted}
              onChange={(value) => update({ showPredicted: value })}
            />
          </SettingRow>
        </div>
      </Card>
    </>
  );
});
