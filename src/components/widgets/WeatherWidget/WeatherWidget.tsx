import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';
import { WindCompass } from './WindCompass/WindCompass';
import { StatsGrid } from './StatsGrid/StatsGrid';
import { ForecastBlock } from './ForecastBlock/ForecastBlock';
import {
  bearingToCardinal,
  parseWeekendFloat,
  radsToBearing,
} from './weather-utils';

import styles from './WeatherWidget.module.scss';

const getWindColor = (mps: number | null): string => {
  if (mps === null) return '#3399ff';
  if (mps > 8) return '#ef4444';
  if (mps > 4) return '#ffcc00';

  return '#3399ff';
};

export const WeatherWidget = observer(() => {
  const weekendInfo = telemetryStore.weekendInfo;
  const env = telemetryStore.environment;
  const {
    showCompass,
    showAirTemp,
    showTrackTemp,
    showWind,
    showHumidity,
    showForecast,
  } = widgetSettingsStore.getWeatherSettings();

  const windVelMps =
    env?.wind_vel ?? parseWeekendFloat(weekendInfo?.TrackWindVel);
  const windDirRad =
    env?.wind_dir ?? parseWeekendFloat(weekendInfo?.TrackWindDir);

  const windBearing = windDirRad !== null ? radsToBearing(windDirRad) : 0;
  const windCardinal = bearingToCardinal(windBearing);
  const windColor = getWindColor(windVelMps);

  const hasStats = showAirTemp || showTrackTemp || showWind || showHumidity;

  return (
    <WidgetPanel direction="column" gap={0} minWidth={80}>
      {showCompass && (
        <div className={styles.compassBlock}>
          <WindCompass
            windBearing={windBearing}
            windCardinal={windCardinal}
            arrowColor={windColor}
          />
        </div>
      )}

      {hasStats && <StatsGrid />}

      {showForecast && <ForecastBlock />}
    </WidgetPanel>
  );
});
