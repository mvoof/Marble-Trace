import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { unitsStore } from '../../../store/units.store';
import {
  bearingToCardinal,
  formatWindSpeed,
  parseWeekendFloat,
  radsToBearing,
} from './weather-utils';
import { WeatherWidget } from './WeatherWidget';

export const WeatherWidgetContainer = observer(() => {
  const weekendInfo = telemetryStore.weekendInfo;
  const env = telemetryStore.environment;
  const carDynamics = telemetryStore.carDynamics;
  const { system, formatTemp, tempUnit } = unitsStore;
  const settings = widgetSettingsStore.getWeatherSettings();

  const windVelMps = parseWeekendFloat(weekendInfo?.TrackWindVel);
  const windDirRad = parseWeekendFloat(weekendInfo?.TrackWindDir);
  const trackTempC = parseWeekendFloat(weekendInfo?.TrackSurfaceTemp);
  const staticAirTempC = parseWeekendFloat(weekendInfo?.TrackAirTemp);

  const airTempC = env?.air_temp ?? staticAirTempC;
  const windBearing = windDirRad !== null ? radsToBearing(windDirRad) : 0;
  const windCardinal = bearingToCardinal(windBearing);
  const windSpeedFormatted = formatWindSpeed(windVelMps, system);

  const carYawRad = carDynamics?.yaw ?? 0;
  const carYawDeg = carYawRad * (180 / Math.PI);

  const rawHumidity = parseWeekendFloat(weekendInfo?.TrackRelativeHumidity);
  const humidity = rawHumidity !== null ? `${Math.round(rawHumidity)}%` : '—';

  return (
    <WeatherWidget
      windBearing={windBearing}
      carYawDeg={carYawDeg}
      windSpeedFormatted={windSpeedFormatted}
      windCardinal={windCardinal}
      airTempFormatted={formatTemp(airTempC)}
      trackTempFormatted={formatTemp(trackTempC)}
      tempUnit={tempUnit}
      humidity={humidity}
      showCompass={settings.showCompass}
      showAirTemp={settings.showAirTemp}
      showTrackTemp={settings.showTrackTemp}
      showWind={settings.showWind}
      showHumidity={settings.showHumidity}
    />
  );
});
