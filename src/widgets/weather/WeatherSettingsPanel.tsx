import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Card } from '@features/widget-settings/Card';
import { schemaRows } from '@features/widget-settings/schema-rows';
import { WEATHER_SETTINGS } from './settings-schema';

// Widget ids this panel configures — read by the panel registry.
export const PANEL_WIDGET_IDS = ['weather'];

const { Row } = schemaRows(WEATHER_SETTINGS);

export const WeatherSettingsPanel = observer(() => {
  const { t } = useTranslation('widgets');

  return (
    <Card title={t('settingsPanels.weather.moduleParameters')}>
      <Row setting="horizontal" />
      <Row setting="showCompass" />
      <Row setting="showCompassRing" dependsOn="showCompass" />
      <Row setting="showAirTemp" />
      <Row setting="showTrackTemp" />
      <Row setting="showWind" />
      <Row setting="showWindBearing" dependsOn="showWind" />
      <Row setting="showHumidity" />
      <Row setting="showForecast" />
      <Row setting="showTrackWetness" />
    </Card>
  );
});
