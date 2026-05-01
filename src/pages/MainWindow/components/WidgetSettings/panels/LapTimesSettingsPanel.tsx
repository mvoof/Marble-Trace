import { observer } from 'mobx-react-lite';
import { Segmented, Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import {
  LapTimesLayout,
  LapTimesWidgetSettings,
} from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

export const LapTimesSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getLapTimesSettings();

  const update = (partial: Partial<LapTimesWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('lap-times', {
      'lap-times': { ...settings, ...partial },
    });
  };

  return (
    <>
      <Card title="Module Layout">
        <div className={styles.fieldGroup}>
          <span className={styles.fieldLabel}>Rows Layout</span>
          <Segmented
            block
            value={settings.layout}
            options={[
              { label: 'Vertical', value: 'vertical' },
              { label: 'Horizontal', value: 'horizontal' },
            ]}
            onChange={(v) => update({ layout: v as LapTimesLayout })}
          />
        </div>
      </Card>

      <Card title="Visible Rows">
        {[
          {
            title: 'Show Last Lap',
            desc: 'Display the time of the last completed lap.',
            value: settings.showLastLap,
            key: 'showLastLap',
          },
          {
            title: 'Show Best Lap',
            desc: 'Display your best lap time in the session.',
            value: settings.showBestLap,
            key: 'showBestLap',
          },
          {
            title: 'Show P1 Lap',
            desc: 'Display the best lap time of your class leader.',
            value: settings.showP1,
            key: 'showP1',
          },
        ].map((item) => (
          <div key={item.key} className={styles.fieldGroup}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldTexts}>
                <div className={styles.fieldTitle}>{item.title}</div>
                <div className={styles.fieldDesc}>{item.desc}</div>
              </div>
              <Switch
                checked={item.value}
                onChange={(v) => update({ [item.key]: v })}
              />
            </div>
          </div>
        ))}
      </Card>
    </>
  );
});
