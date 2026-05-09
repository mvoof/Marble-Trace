import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import { WeatherWidgetSettings } from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card, SettingRow } from './shared';

export const WeatherSettingsPanel = observer(() => {
  const settings = widgetSettingsStore.getWeatherSettings();

  const update = (partial: Partial<WeatherWidgetSettings>) => {
    widgetSettingsStore.updateCustomSettings('weather', {
      weather: { ...settings, ...partial },
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
