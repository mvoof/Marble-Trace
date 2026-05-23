import { observer } from 'mobx-react-lite';
import { Segmented, Switch } from 'antd';
import {
  LapDeltaLayout,
  LapDeltaReference,
  LapDeltaWidgetSettings,
} from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card, SettingRow } from './shared';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const LapDeltaSettingsPanel = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<LapDeltaWidgetSettings>('lap-delta');

  const update = (partial: Partial<LapDeltaWidgetSettings>) => {
    widgetSettings.updateUserSettings('lap-delta', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title="Module Parameters">
      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Reference Target</span>
        <Segmented
          block
          value={settings.reference}
          options={[
            { label: 'Session Best', value: 'session_best' },
            { label: 'Personal Best', value: 'personal_best' },
          ]}
          onChange={(v) => update({ reference: v as LapDeltaReference })}
        />
        <div className={styles.fieldDesc} style={{ marginTop: 8 }}>
          Session Best uses iRacing native live delta. Personal Best uses your
          own fastest lap in this session as reference.
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <span className={styles.fieldLabel}>Sectors Layout</span>
        <Segmented
          block
          value={settings.layout}
          options={[
            { label: 'Vertical', value: 'vertical' },
            { label: 'Horizontal', value: 'horizontal' },
          ]}
          onChange={(v) => update({ layout: v as LapDeltaLayout })}
        />
      </div>

      <div className={styles.fieldGroup}>
        <SettingRow
          title="Sector Times"
          desc="Show per-sector time below the delta bar."
        >
          <Switch
            checked={settings.showSectorTimes}
            onChange={(v) => update({ showSectorTimes: v })}
          />
        </SettingRow>
      </div>
    </Card>
  );
});
