import { observer } from 'mobx-react-lite';

import type { Skies as BindingSkies } from '@/types/bindings';
import {
  convertTemp,
  formatSpeed,
  speedUnit,
} from '@utils/formatters/telemetry-format';

import styles from './ForecastBlock.module.scss';
import type { WeatherWidgetSettings } from '@/types/widget-settings';
import {
  useEnvironmentStore,
  useSessionStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const SKIES_LABELS: Record<BindingSkies, string> = {
  Clear: 'Clear',
  PartlyCloudy: 'Partly Cloudy',
  MostlyCloudy: 'Mostly Cloudy',
  Overcast: 'Overcast',
};

const getSkiesLabel = (skies: BindingSkies): string =>
  SKIES_LABELS[skies] ?? 'Unknown';

const formatForecastTime = (timeSec: number): string => {
  const hours = Math.floor(timeSec / 3600);
  const minutes = Math.floor((timeSec % 3600) / 60);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const ForecastBlock = observer(() => {
  const { weatherForecast } = useEnvironmentStore();
  const { sessionInfo } = useSessionStore();
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const { showForecast } =
    widgetSettings.getSettings<WeatherWidgetSettings>('weather');

  if (!showForecast) {
    return null;
  }

  const { unitSystem } = units;

  const forecast = weatherForecast || [];

  const weatherType = sessionInfo?.trackWeatherType || null;

  return (
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
        <div className={styles.forecastRow}>
          {weatherType === 'Static' || weatherType === 'Realistic'
            ? `Forecast unavailable (${weatherType} Weather)`
            : 'No forecast data available'}
        </div>
      )}
    </div>
  );
});
