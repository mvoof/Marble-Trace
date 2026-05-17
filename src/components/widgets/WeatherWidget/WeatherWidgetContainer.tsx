import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { unitsStore } from '../../../store/units.store';
import { formatTemp, tempUnit } from '../../../utils/telemetry-format';
import {
  bearingToCardinal,
  extractForecast,
  formatWindSpeed,
  parseWeekendFloat,
  radsToBearing,
} from './weather-utils';
import { WeatherWidget } from './WeatherWidget';

const getWindColor = (mps: number | null): string => {
  if (mps === null) return '#3399ff';
  if (mps > 8) return '#ef4444';
  if (mps > 4) return '#ffcc00';

  return '#3399ff';
};

export const WeatherWidgetContainer = observer(() => {
  const weekendInfo = telemetryStore.weekendInfo;
  const env = telemetryStore.environment;
  const { system } = unitsStore;
  const settings = widgetSettingsStore.getWeatherSettings();

  const windVelMps =
    env?.wind_vel ?? parseWeekendFloat(weekendInfo?.TrackWindVel);
  const windDirRad =
    env?.wind_dir ?? parseWeekendFloat(weekendInfo?.TrackWindDir);
  const trackTempC =
    env?.track_temp ?? parseWeekendFloat(weekendInfo?.TrackSurfaceTemp);
  const staticAirTempC = parseWeekendFloat(weekendInfo?.TrackAirTemp);

  const airTempC = env?.air_temp ?? staticAirTempC;
  const windBearing = windDirRad !== null ? radsToBearing(windDirRad) : 0;
  const windCardinal = bearingToCardinal(windBearing);
  const windSpeedFormatted = formatWindSpeed(windVelMps, system);
  const windColor = getWindColor(windVelMps);

  const rawHumidity =
    env?.relative_humidity !== undefined && env?.relative_humidity !== null
      ? env.relative_humidity * 100
      : parseWeekendFloat(weekendInfo?.TrackRelativeHumidity);

  const humidity = rawHumidity !== null ? `${Math.round(rawHumidity)}%` : '—';

  let forecast = telemetryStore.weatherForecast || [];

  if (forecast.length === 0 && weekendInfo) {
    forecast = extractForecast(weekendInfo);
  }

  return (
    <WeatherWidget
      windBearing={windBearing}
      windSpeedFormatted={windSpeedFormatted}
      windCardinal={windCardinal}
      windColor={windColor}
      airTempFormatted={formatTemp(airTempC, system)}
      trackTempFormatted={formatTemp(trackTempC, system)}
      tempUnit={tempUnit(system)}
      unitSystem={system}
      humidity={humidity}
      forecast={forecast}
      weatherType={weekendInfo?.TrackWeatherType ?? null}
      showCompass={settings.showCompass}
      showAirTemp={settings.showAirTemp}
      showTrackTemp={settings.showTrackTemp}
      showWind={settings.showWind}
      showHumidity={settings.showHumidity}
      showForecast={settings.showForecast}
    />
  );
});
