import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing/telemetry.store';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { unitsStore } from '../../../store/units.store';
import { formatTemp, tempUnit } from '../../../utils/telemetry-format';
import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';
import { WindCompass } from './WindCompass/WindCompass';
import { ForecastBlock } from './ForecastBlock/ForecastBlock';
import {
  bearingToCardinal,
  formatWindSpeed,
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

      {showForecast && <ForecastBlock />}
    </WidgetPanel>
  );
});
