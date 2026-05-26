import { observer } from 'mobx-react-lite';
import { Segmented, Switch } from 'antd';
import type {
  LapDeltaReference,
  SectorMatrixWidgetSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card, DELTA_REFERENCE_DESC, SettingRow } from './shared';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const SectorMatrixSettingsPanel = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const settings =
    widgetSettings.getSettings<SectorMatrixWidgetSettings>('sector-matrix');

  const update = (partial: Partial<SectorMatrixWidgetSettings>) => {
    widgetSettings.updateUserSettings('sector-matrix', {
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
            {DELTA_REFERENCE_DESC[settings.reference]} Sector chips always show
            delta vs personal best.
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
