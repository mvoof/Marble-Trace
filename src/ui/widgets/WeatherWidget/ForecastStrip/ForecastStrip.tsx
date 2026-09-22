import { observer } from 'mobx-react-lite';
import { Droplet } from 'lucide-react';

import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { convertTemp } from '@utils/telemetry-format';
import type { WeatherWidgetSettings } from '@/types/widget-settings';
import {
  useEnvironmentStore,
  useSessionStore,
  useUnitsStore,
} from '@store/root-store-context';

import { weatherIconFor } from '../weather-icons';
import styles from './ForecastStrip.module.scss';

// The strip is a row of equal cells, so the hours it can show are bounded by
// how narrow a cell may get before its temperature stops being readable.
const MAX_FORECAST_CELLS = 5;
const SKY_ICON_SIZE_PX = 14;
const RAIN_ICON_SIZE_PX = 10;

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

const formatForecastHour = (timeSec: number): string => {
  const hours = Math.floor(timeSec / SECONDS_PER_HOUR);
  const minutes = Math.floor((timeSec % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const ForecastStrip = observer(() => {
  const { weatherForecast } = useEnvironmentStore();
  const { sessionInfo } = useSessionStore();
  const { unitSystem } = useUnitsStore();

  const { showForecast } = useWidgetSettings<WeatherWidgetSettings>('weather');

  if (!showForecast) {
    return null;
  }

  const forecast = (weatherForecast || []).slice(0, MAX_FORECAST_CELLS);

  if (forecast.length === 0) {
    const weatherType = sessionInfo?.trackWeatherType || null;

    return (
      <div className={styles.strip}>
        <div className={styles.emptyCell}>
          {weatherType === 'Static' || weatherType === 'Realistic'
            ? `Forecast unavailable (${weatherType} Weather)`
            : 'No forecast data available'}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.strip}>
      {forecast.map((entry, index) => {
        const SkyIcon = weatherIconFor(entry.Skies, null);

        return (
          <div
            key={entry.Time}
            className={`${styles.cell} ${index === 0 ? styles.cellNow : ''}`}
          >
            <span className={styles.time}>
              {formatForecastHour(entry.Time)}
            </span>

            <div className={styles.skyRow}>
              <SkyIcon size={SKY_ICON_SIZE_PX} className={styles.skyIcon} />

              <Droplet size={RAIN_ICON_SIZE_PX} className={styles.rainIcon} />

              <span className={styles.rainPct}>
                {Math.round(entry.RainPct)}%
              </span>
            </div>

            <span className={styles.temp}>
              {Math.round(convertTemp(entry.Temp, unitSystem))}°
            </span>
          </div>
        );
      })}
    </div>
  );
});
