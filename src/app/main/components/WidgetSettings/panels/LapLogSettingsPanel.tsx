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
          Reference for the live row delta. PB/PO — personal best/optimal. SB/SO
          — session best/optimal. SL — session last lap. Historical rows always
          compare vs personal best.
        </div>
      </div>
    </Card>
  );
});
