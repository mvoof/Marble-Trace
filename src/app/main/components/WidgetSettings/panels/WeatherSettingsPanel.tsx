import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Switch } from 'antd';
import { WeatherWidgetSettings } from '@/types/widget-settings';
import styles from '@app/main/components/WidgetSettings/WidgetSettings.module.scss';
import { Card } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

export const WeatherSettingsPanel = observer(() => {
  const widgetSettings = useWidgetEditor();
  const { t } = useTranslation('widgets');

  const settings = widgetSettings.getSettings<WeatherWidgetSettings>('weather');

  const update = (partial: Partial<WeatherWidgetSettings>) => {
    widgetSettings.updateUserSettings('weather', {
      ...settings,
      ...partial,
    });
  };

  const items = [
    {
      titleKey: 'settingsPanels.weather.windCompass',
      descKey: 'settingsPanels.weather.windCompassDesc',
      value: settings.showCompass,
      key: 'showCompass',
    },
    {
      titleKey: 'settingsPanels.weather.airTemperature',
      descKey: 'settingsPanels.weather.airTemperatureDesc',
      value: settings.showAirTemp,
      key: 'showAirTemp',
    },
    {
      titleKey: 'settingsPanels.weather.trackTemperature',
      descKey: 'settingsPanels.weather.trackTemperatureDesc',
      value: settings.showTrackTemp,
      key: 'showTrackTemp',
    },
    {
      titleKey: 'settingsPanels.weather.windSpeedAndDir',
      descKey: 'settingsPanels.weather.windSpeedAndDirDesc',
      value: settings.showWind,
      key: 'showWind',
    },
    {
      titleKey: 'settingsPanels.weather.relativeHumidity',
      descKey: 'settingsPanels.weather.relativeHumidityDesc',
      value: settings.showHumidity,
      key: 'showHumidity',
    },
    {
      titleKey: 'settingsPanels.weather.weatherForecast',
      descKey: 'settingsPanels.weather.weatherForecastDesc',
      value: settings.showForecast,
      key: 'showForecast',
    },
    {
      titleKey: 'settingsPanels.weather.trackWetnessState',
      descKey: 'settingsPanels.weather.trackWetnessStateDesc',
      value: settings.showTrackWetness,
      key: 'showTrackWetness',
    },
  ] as const;

  return (
    <Card title={t('settingsPanels.weather.moduleParameters')}>
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
