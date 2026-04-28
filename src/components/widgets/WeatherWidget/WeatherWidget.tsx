import { forwardRef } from 'react';

import type { WeatherForecastEntry } from '../../../types/bindings';
import type { UnitSystem } from '../../../types/units';
import { formatSpeed, speedUnit } from '../../../utils/telemetry-format';
import { WidgetPanel } from '../primitives/WidgetPanel';
import { WindCompass } from './WindCompass/WindCompass';

import styles from './WeatherWidget.module.scss';

interface WeatherWidgetProps {
  windBearing: number;
  carYawDeg: number;
  windSpeedFormatted: string;
  windCardinal: string;
  windColor: string;
  airTempFormatted: string;
  trackTempFormatted: string;
  tempUnit: string;
  unitSystem: UnitSystem;
  humidity: string;
  forecast: WeatherForecastEntry[];
  weatherType: string | null;
  showCompass: boolean;
  showAirTemp: boolean;
  showTrackTemp: boolean;
  showWind: boolean;
  showHumidity: boolean;
  showForecast: boolean;
}

const buildStatCells = (
  airTempFormatted: string,
  trackTempFormatted: string,
  tempUnit: string,
  windSpeedFormatted: string,
  windCardinal: string,
  windColor: string,
  humidity: string,
  showAirTemp: boolean,
  showTrackTemp: boolean,
  showWind: boolean,
  showHumidity: boolean
) =>
  [
    showAirTemp && {
      key: 'air',
      label: 'AIR',
      value: airTempFormatted,
      unit: tempUnit,
      color: '#fff',
    },
    showTrackTemp && {
      key: 'trk',
      label: 'TRK',
      value: trackTempFormatted,
      unit: tempUnit,
      color: '#fbbf24',
    },
    showWind && {
      key: 'wind',
      label: 'WIND',
      value: windSpeedFormatted,
      sub: windCardinal,
      color: windColor,
    },
    showHumidity && {
      key: 'hum',
      label: 'HUM.',
      value: humidity,
      color: '#fff',
    },
  ].filter(Boolean) as {
    key: string;
    label: string;
    value: string;
    unit?: string;
    sub?: string;
    color: string;
  }[];

const formatForecastTime = (timeSec: number): string => {
  const h = Math.floor(timeSec / 3600);
  const m = Math.floor((timeSec % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const SKIES_LABELS: Record<number, string> = {
  0: 'Clear',
  1: 'Partly Cloudy',
  2: 'Mostly Cloudy',
  3: 'Overcast',
};

const getSkiesLabel = (skies: number): string =>
  SKIES_LABELS[skies] ?? 'Unknown';

const convertTemp = (celsius: number, system: UnitSystem): number => {
  if (system === 'imperial') {
    return (celsius * 9) / 5 + 32;
  }
  return celsius;
};

export const WeatherWidget = forwardRef<HTMLElement, WeatherWidgetProps>(
  (
    {
      windBearing,
      carYawDeg,
      windSpeedFormatted,
      windCardinal,
      windColor,
      airTempFormatted,
      trackTempFormatted,
      tempUnit,
      unitSystem,
      humidity,
      forecast,
      weatherType,
      showCompass,
      showAirTemp,
      showTrackTemp,
      showWind,
      showHumidity,
      showForecast,
    },
    ref
  ) => {
    const stats = buildStatCells(
      airTempFormatted,
      trackTempFormatted,
      tempUnit,
      windSpeedFormatted,
      windCardinal,
      windColor,
      humidity,
      showAirTemp,
      showTrackTemp,
      showWind,
      showHumidity
    );

    const hasStats = stats.length > 0;

    return (
      <WidgetPanel
        ref={ref}
        direction="column"
        gap={0}
        minWidth={200}
        fitContent
      >
        {showCompass && (
          <div className={styles.compassBlock}>
            <WindCompass
              windBearing={windBearing}
              carYawDeg={carYawDeg}
              windCardinal={windCardinal}
              arrowColor={windColor}
              size={200}
            />
          </div>
        )}

        {hasStats && (
          <div className={styles.statsGrid}>
            {stats.map((cell) => (
              <div
                key={cell.key}
                className={styles.statCell}
                style={{ borderLeftColor: cell.color }}
              >
                <span className={styles.statLabel}>{cell.label}</span>
                <span className={styles.statValue}>
                  {cell.value}
                  {cell.unit && (
                    <span className={styles.statUnit}>{cell.unit}</span>
                  )}
                  {cell.sub && (
                    <span className={styles.statSub}> {cell.sub}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {showForecast && (
          <div className={styles.forecastBlock}>
            {forecast.length > 0 ? (
              forecast.map((entry, idx) => (
                <div key={idx} className={styles.forecastRow}>
                  <span className={styles.forecastTime}>
                    {formatForecastTime(entry.Time)}
                  </span>
                  <span className={styles.forecastSkies}>
                    {getSkiesLabel(entry.Skies)}
                  </span>
                  <div className={styles.forecastRight}>
                    <span className={styles.forecastTemp}>
                      {Math.round(convertTemp(entry.Temp, unitSystem))}°
                    </span>
                    <span className={styles.forecastWind}>
                      {formatSpeed(entry.WindSpeed, unitSystem)}{' '}
                      {speedUnit(unitSystem)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div
                className={styles.forecastRow}
                style={{ opacity: 0.5, fontSize: '0.7rem' }}
              >
                {weatherType === 'Static' || weatherType === 'Realistic'
                  ? `Forecast unavailable (${weatherType} Weather)`
                  : 'No forecast data available'}
              </div>
            )}
          </div>
        )}
      </WidgetPanel>
    );
  }
);

WeatherWidget.displayName = 'WeatherWidget';
