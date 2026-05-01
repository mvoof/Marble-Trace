import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import { TimerWidgetSettings } from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

export const TimerSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getTimerSettings();

  const update = (partial: Partial<TimerWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('timer', {
      timer: { ...settings, ...partial },
    });
  };

  return (
    <Card title="Visible Elements">
      {[
        {
          title: 'Show Flag State',
          desc: 'Display session status: green running / final 5 min / checkered.',
          value: settings.showFlag,
          key: 'showFlag',
        },
        {
          title: 'Show Lap Count',
          desc: 'Display current lap and total laps.',
          value: settings.showLaps,
          key: 'showLaps',
        },
        {
          title: 'Show Position',
          desc: 'Display your current race position.',
          value: settings.showPosition,
          key: 'showPosition',
        },
        {
          title: 'Show PC Clock',
          desc: 'Display current system time (HH:MM).',
          value: settings.showWallClock,
          key: 'showWallClock',
        },
        {
          title: 'Show Sim Time',
          desc: 'Display in-simulator time of day (HH:MM).',
          value: settings.showSimTime,
          key: 'showSimTime',
        },
        {
          title: 'Show PC Date',
          desc: 'Display current system date.',
          value: settings.showPcDate,
          key: 'showPcDate',
        },
        {
          title: 'Show Sim Date',
          desc: 'Display in-simulator date (may differ from real date).',
          value: settings.showSimDate,
          key: 'showSimDate',
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
  );
});
