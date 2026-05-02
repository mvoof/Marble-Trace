import { observer } from 'mobx-react-lite';
import { Segmented, Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import {
  LapDeltaLayout,
  LapDeltaReference,
  LapDeltaWidgetSettings,
} from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

export const LapDeltaSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getLapDeltaSettings();

  const update = (partial: Partial<LapDeltaWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('lap-delta', {
      'lap-delta': { ...settings, ...partial },
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
        <span className={styles.fieldLabel}>Show Sector Times</span>
        <Switch
          checked={settings.showSectorTimes}
          onChange={(v) => update({ showSectorTimes: v })}
        />
      </div>
    </Card>
  );
});
