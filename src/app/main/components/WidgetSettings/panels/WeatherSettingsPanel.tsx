import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import { WeatherWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const WeatherSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();

  const settings = widgetSettings.getSettings<WeatherWidgetSettings>('weather');

  const update = (partial: Partial<WeatherWidgetSettings>) => {
    widgetSettings.updateUserSettings('weather', {
      ...settings,
      ...partial,
    });
  };

  return (
    <Card title="Module Parameters">
      {[
        {
          title: 'Wind Compass',
          desc: 'Animated compass showing current wind direction.',
          value: settings.showCompass,
          key: 'showCompass',
        },
        {
          title: 'Air Temperature',
          desc: 'Ambient air temperature at track level.',
          value: settings.showAirTemp,
          key: 'showAirTemp',
        },
        {
          title: 'Track Temperature',
          desc: 'Surface temperature of the racing surface.',
          value: settings.showTrackTemp,
          key: 'showTrackTemp',
        },
        {
          title: 'Wind Speed & Dir',
          desc: 'Numerical wind speed and cardinal direction.',
          value: settings.showWind,
          key: 'showWind',
        },
        {
          title: 'Relative Humidity',
          desc: 'Current humidity percentage.',
          value: settings.showHumidity,
          key: 'showHumidity',
        },
        {
          title: 'Weather Forecast',
          desc: 'Upcoming weather changes during the session.',
          value: settings.showForecast,
          key: 'showForecast',
        },
        {
          title: 'Track Wetness State',
          desc: 'Current track surface wetness level (Dry, Damp, Wet, Flooded).',
          value: settings.showTrackWetness,
          key: 'showTrackWetness',
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
