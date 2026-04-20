import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import { unitsStore } from '../../../store/units.store';
import {
  bearingToCardinal,
  formatWindSpeed,
  getSkiesIconType,
  parseWeekendFloat,
  radsToBearing,
} from './weather-utils';
import { WeatherWidget } from './WeatherWidget';

export const WeatherWidgetContainer = observer(() => {
  const weekendInfo = telemetryStore.weekendInfo;
  const env = telemetryStore.environment;
  const carDynamics = telemetryStore.carDynamics;
  const { system, formatTemp, tempUnit } = unitsStore;

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

  const skiesText = weekendInfo?.TrackSkies ?? '';

  return (
    <WeatherWidget
      windBearing={windBearing}
      carYawDeg={carYawDeg}
      windSpeedFormatted={windSpeedFormatted}
      windCardinal={windCardinal}
      airTempFormatted={formatTemp(airTempC)}
      trackTempFormatted={formatTemp(trackTempC)}
      tempUnit={tempUnit}
      skiesText={skiesText}
      skiesIcon={getSkiesIconType(skiesText)}
    />
  );
});
