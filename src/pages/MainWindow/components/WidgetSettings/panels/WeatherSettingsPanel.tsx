import { observer } from 'mobx-react-lite';
import { Switch } from 'antd';
import { widgetSettingsStore } from '../../../../../store/widget-settings.store';
import { WeatherWidgetSettings } from '../../../../../types/widget-settings';
import styles from '../WidgetSettings.module.scss';
import { Card } from './shared';

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
          value: settings.showCompass,
          key: 'showCompass',
        },
        {
          title: 'Air Temperature',
          value: settings.showAirTemp,
          key: 'showAirTemp',
        },
        {
          title: 'Track Temperature',
          value: settings.showTrackTemp,
          key: 'showTrackTemp',
        },
        {
          title: 'Wind Speed & Dir',
          value: settings.showWind,
          key: 'showWind',
        },
        {
          title: 'Relative Humidity',
          value: settings.showHumidity,
          key: 'showHumidity',
        },
        {
          title: 'Weather Forecast',
          value: settings.showForecast,
          key: 'showForecast',
        },
      ].map((item) => (
        <div key={item.key} className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldTexts}>
              <div className={styles.fieldTitle}>{item.title}</div>
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
