import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { WeatherWidgetSettings } from '@/types/widget-settings';
import { Card } from './Card';
import { panelRows } from './setting-rows';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['weather'];

const { SwitchRow } = panelRows<WeatherWidgetSettings>();

export const WeatherSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.weather.moduleParameters')}>
      <SwitchRow
        settingKey="horizontal"
        title={t('settingsPanels.weather.horizontalLayout')}
        desc={t('settingsPanels.weather.horizontalLayoutDesc')}
      />

      <SwitchRow
        settingKey="showCompass"
        title={t('settingsPanels.weather.windCompass')}
        desc={t('settingsPanels.weather.windCompassDesc')}
      />

      <SwitchRow
        settingKey="showCompassRing"
        dependsOn="showCompass"
        title={t('settingsPanels.weather.windCompassRing')}
        desc={t('settingsPanels.weather.windCompassRingDesc')}
      />

      <SwitchRow
        settingKey="showAirTemp"
        title={t('settingsPanels.weather.airTemperature')}
        desc={t('settingsPanels.weather.airTemperatureDesc')}
      />

      <SwitchRow
        settingKey="showTrackTemp"
        title={t('settingsPanels.weather.trackTemperature')}
        desc={t('settingsPanels.weather.trackTemperatureDesc')}
      />

      <SwitchRow
        settingKey="showWind"
        title={t('settingsPanels.weather.windSpeedAndDir')}
        desc={t('settingsPanels.weather.windSpeedAndDirDesc')}
      />

      <SwitchRow
        settingKey="showWindBearing"
        dependsOn="showWind"
        title={t('settingsPanels.weather.windBearing')}
        desc={t('settingsPanels.weather.windBearingDesc')}
      />

      <SwitchRow
        settingKey="showHumidity"
        title={t('settingsPanels.weather.relativeHumidity')}
        desc={t('settingsPanels.weather.relativeHumidityDesc')}
      />

      <SwitchRow
        settingKey="showForecast"
        title={t('settingsPanels.weather.weatherForecast')}
        desc={t('settingsPanels.weather.weatherForecastDesc')}
      />

      <SwitchRow
        settingKey="showTrackWetness"
        title={t('settingsPanels.weather.trackWetnessState')}
        desc={t('settingsPanels.weather.trackWetnessStateDesc')}
      />
    </Card>
  );
});
