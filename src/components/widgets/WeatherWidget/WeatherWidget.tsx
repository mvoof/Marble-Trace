import { observer } from 'mobx-react-lite';

import type {
  WeatherForecastEntry,
  Skies as BindingSkies,
} from '../../../types/bindings';
import type { UnitSystem } from '../../../types';
import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { unitsStore } from '../../../store/units.store';
import {
  formatSpeed,
  formatTemp,
  speedUnit,
  tempUnit,
} from '../../../utils/telemetry-format';
import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';
import { WindCompass } from './WindCompass/WindCompass';
import {
  bearingToCardinal,
  extractForecast,
  formatWindSpeed,
  parseWeekendFloat,
  radsToBearing,
} from './weather-utils';

import styles from './WeatherWidget.module.scss';

const formatForecastTime = (timeSec: number): string => {
  const hours = Math.floor(timeSec / 3600);
  const minutes = Math.floor((timeSec % 3600) / 60);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const SKIES_LABELS: Record<BindingSkies, string> = {
  Clear: 'Clear',
  PartlyCloudy: 'Partly Cloudy',
  MostlyCloudy: 'Mostly Cloudy',
  Overcast: 'Overcast',
};

const getSkiesLabel = (skies: BindingSkies): string =>
  SKIES_LABELS[skies] ?? 'Unknown';

const convertTemp = (celsius: number, system: UnitSystem): number => {
  if (system === 'imperial') {
    return (celsius * 9) / 5 + 32;
  }

  return celsius;
};

const getWindColor = (mps: number | null): string => {
  if (mps === null) return '#3399ff';
  if (mps > 8) return '#ef4444';
  if (mps > 4) return '#ffcc00';

  return '#3399ff';
};

interface StatCell {
  key: string;
  label: string;
  value: string;
  unit?: string;
  color: string;
  wide?: boolean;
}

const buildStatCells = (
  airTempFormatted: string,
  trackTempFormatted: string,
  tempUnitLabel: string,
  windSpeedFormatted: string,
  windColor: string,
  humidity: string,
  showAirTemp: boolean,
  showTrackTemp: boolean,
  showWind: boolean,
  showHumidity: boolean
): StatCell[] => {
  const cells: StatCell[] = [];

  if (showAirTemp) {
    cells.push({
      key: 'air',
      label: 'AIR',
      value: airTempFormatted,
      unit: tempUnitLabel,
      color: '#fff',
    });
  }

  if (showTrackTemp) {
    cells.push({
      key: 'trk',
      label: 'TRK',
      value: trackTempFormatted,
      unit: tempUnitLabel,
      color: '#fbbf24',
    });
  }

  if (showWind) {
    cells.push({
      key: 'wind',
      label: 'WIND',
      value: windSpeedFormatted,
      color: windColor,
      wide: true,
    });
  }

  if (showHumidity) {
    cells.push({
      key: 'hum',
      label: 'HUM.',
      value: humidity,
      color: '#fff',
    });
  }

  return cells;
};

export const WeatherWidget = observer(() => {
  const weekendInfo = telemetryStore.weekendInfo;
  const env = telemetryStore.environment;
  const { system } = unitsStore;
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

  const airTempFormatted = formatTemp(airTempC, system);
  const trackTempFormatted = formatTemp(trackTempC, system);
  const tempUnitLabel = tempUnit(system);

  let forecast: WeatherForecastEntry[] = telemetryStore.weatherForecast || [];

  if (forecast.length === 0 && weekendInfo) {
    forecast = extractForecast(weekendInfo);
  }

  const weatherType = weekendInfo?.TrackWeatherType ?? null;

  const stats = buildStatCells(
    airTempFormatted,
    trackTempFormatted,
    tempUnitLabel,
    windSpeedFormatted,
    windColor,
    humidity,
    showAirTemp,
    showTrackTemp,
    showWind,
    showHumidity
  );

  const hasStats = stats.length > 0;

  return (
    <WidgetPanel direction="column" gap={0} minWidth={200}>
      {showCompass && (
        <div className={styles.compassBlock}>
          <WindCompass
            windBearing={windBearing}
            windCardinal={windCardinal}
            arrowColor={windColor}
          />
        </div>
      )}

      {hasStats && (
        <div className={styles.statsGrid}>
          {stats.map((cell) => (
            <div
              key={cell.key}
              className={`${styles.statCell}${cell.wide ? ` ${styles.statCellWide}` : ''}`}
              style={{ borderLeftColor: cell.color }}
            >
              <span className={styles.statLabel}>{cell.label}</span>

              <span className={styles.statValue}>
                {cell.value}
                {cell.unit && (
                  <span className={styles.statUnit}>{cell.unit}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {showForecast && (
        <div className={styles.forecastBlock}>
          {forecast.length > 0 ? (
            forecast.map((entry) => (
              <div key={entry.Time} className={styles.forecastRow}>
                <span className={styles.forecastTime}>
                  {formatForecastTime(entry.Time)}
                </span>

                <span className={styles.forecastSkies}>
                  {getSkiesLabel(entry.Skies)}
                </span>

                <div className={styles.forecastRight}>
                  <span className={styles.forecastTemp}>
                    {Math.round(convertTemp(entry.Temp, system))}°
                  </span>

                  <span className={styles.forecastWind}>
                    {formatSpeed(entry.WindSpeed, system)} {speedUnit(system)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.forecastRow}>
              {weatherType === 'Static' || weatherType === 'Realistic'
                ? `Forecast unavailable (${weatherType} Weather)`
                : 'No forecast data available'}
            </div>
          )}
        </div>
      )}
    </WidgetPanel>
  );
});
