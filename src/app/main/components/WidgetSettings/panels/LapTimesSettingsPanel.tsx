import { observer } from 'mobx-react-lite';
import { Segmented, Switch } from 'antd';
import type {
  LapDeltaReference,
  LapTimesWidgetSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card, DELTA_REFERENCE_DESC, SettingRow } from './shared';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const LapTimesSettingsPanel = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const settings =
    widgetSettings.getSettings<LapTimesWidgetSettings>('lap-times');

  const update = (partial: Partial<LapTimesWidgetSettings>) => {
    widgetSettings.updateUserSettings('lap-times', { ...settings, ...partial });
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

      <Card title="Options">
        <div className={styles.fieldGroup}>
          <SettingRow
            title="Show Predicted Lap"
            desc="Estimated finish time based on live delta."
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
