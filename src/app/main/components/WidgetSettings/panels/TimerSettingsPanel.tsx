import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Switch } from 'antd';
import { TimerWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const TimerSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings = widgetSettings.getSettings<TimerWidgetSettings>('timer');

  const update = (partial: Partial<TimerWidgetSettings>) => {
    widgetSettings.updateUserSettings('timer', {
      ...settings,
      ...partial,
    });
  };

  const items = [
    {
      titleKey: 'settingsPanels.timer.showSessionType',
      descKey: 'settingsPanels.timer.showSessionTypeDesc',
      value: settings.showSessionType,
      key: 'showSessionType',
    },
    {
      titleKey: 'settingsPanels.timer.showLapCount',
      descKey: 'settingsPanels.timer.showLapCountDesc',
      value: settings.showLaps,
      key: 'showLaps',
    },
    {
      titleKey: 'settingsPanels.timer.showPosition',
      descKey: 'settingsPanels.timer.showPositionDesc',
      value: settings.showPosition,
      key: 'showPosition',
    },
    {
      titleKey: 'settingsPanels.timer.showPcClock',
      descKey: 'settingsPanels.timer.showPcClockDesc',
      value: settings.showWallClock,
      key: 'showWallClock',
    },
    {
      titleKey: 'settingsPanels.timer.showSimTime',
      descKey: 'settingsPanels.timer.showSimTimeDesc',
      value: settings.showSimTime,
      key: 'showSimTime',
    },
    {
      titleKey: 'settingsPanels.timer.showPcDate',
      descKey: 'settingsPanels.timer.showPcDateDesc',
      value: settings.showPcDate,
      key: 'showPcDate',
    },
    {
      titleKey: 'settingsPanels.timer.showSimDate',
      descKey: 'settingsPanels.timer.showSimDateDesc',
      value: settings.showSimDate,
      key: 'showSimDate',
    },
  ] as const;

  return (
    <Card title={t('settingsPanels.timer.visibleElements')}>
      {items.map((item) => (
        <div key={item.key} className={styles.fieldGroup}>
          <SettingRow title={t(item.titleKey)} desc={t(item.descKey)}>
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
