import { observer } from 'mobx-react-lite';
import { Sun, CloudSun, Cloud, CloudRain } from 'lucide-react';

import { convertTemp, tempUnit } from '@utils/formatters/telemetry-format';
import { parseWeekendFloat, getWeatherIcon } from '@utils/widget/weather-utils';
import type { WeatherWidgetSettings } from '@/types/widget-settings';
import {
  useEnvironmentStore,
  useSessionStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './WeatherHeader.module.scss';

const ICON_MAP = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
};

const SKIES_LABELS: Record<string, string> = {
  Clear: 'Clear',
  PartlyCloudy: 'Partly Cloudy',
  MostlyCloudy: 'Mostly Cloudy',
  Overcast: 'Overcast',
};

const ICON_COLOR = '#ffffff';

export const WeatherHeader = observer(() => {
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<WeatherWidgetSettings>('weather');
  const { showAirTemp, showCompass } = settings;

  if (!showAirTemp) {
    return null;
  }

  const { sessionInfo } = useSessionStore();
  const { environment } = useEnvironmentStore();
  const { unitSystem } = units;
  const tUnit = tempUnit(unitSystem);

  const airTempC =
    environment?.air_temp ?? parseWeekendFloat(sessionInfo?.trackAirTemp);
  const skies = environment?.skies;
  const wetness = environment?.track_wetness;

  const iconName = getWeatherIcon(skies, wetness);
  const WeatherIcon = ICON_MAP[iconName] ?? Sun;
  const iconColor = ICON_COLOR;

  const skiesLabel = skies ? (SKIES_LABELS[skies] ?? skies) : 'Clear';

  return (
    <div className={`${styles.header} ${showCompass ? styles.hasCompass : ''}`}>
      <div className={styles.conditionSection}>
        <div className={styles.iconWrapper}>
          <WeatherIcon size={24} color={iconColor} className={styles.icon} />
        </div>
        <span className={styles.conditionText}>{skiesLabel}</span>
      </div>

      {airTempC !== null && (
        <span className={styles.airTempValue}>
          {Math.round(convertTemp(airTempC, unitSystem))}
          <span className={styles.unit}>{tUnit}</span>
        </span>
      )}
    </div>
  );
});
