import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import { TimerWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const TimerSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();

  const settings = widgetSettings.getSettings<TimerWidgetSettings>('timer');

  const update = (partial: Partial<TimerWidgetSettings>) => {
    widgetSettings.updateUserSettings('timer', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title="Visible Elements">
      {[
        {
          title: 'Show Session Type',
          desc: 'Display the current session type (Race, Qualify, Practice).',
          value: settings.showSessionType,
          key: 'showSessionType',
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
          <SettingRow title={item.title} desc={item.desc}>
            <Switch
              checked={item.value}
              onChange={(v) => update({ [item.key]: v })}
            />
          </SettingRow>
        </div>
      ))}
    </Card>
  );
});
