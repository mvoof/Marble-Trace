import { observer } from 'mobx-react-lite';
import { Segmented } from 'antd';
import type {
  LapDeltaReference,
  LapLogWidgetSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './shared';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const LapLogSettingsPanel = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const settings = widgetSettings.getSettings<LapLogWidgetSettings>('lap-log');

  const update = (partial: Partial<LapLogWidgetSettings>) => {
    widgetSettings.updateUserSettings('lap-log', {
      ...settings,
      ...partial,
    });
  };

  return (
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
          Reference used for the live row delta. Historical lap deltas are
          always vs personal best lap time.
        </div>
      </div>
    </Card>
  );
});
