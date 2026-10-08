import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';
import { Sun, CloudSun, Cloud, CloudRain } from 'lucide-react';

import { convertTemp, tempUnit } from '@shared/lib/telemetry-format';
import {
  parseWeekendFloat,
  getWeatherIcon,
  getSkiesLabel,
} from '@shared/lib/weather-utils';
import type { WeatherWidgetSettings } from '@shared/contracts/widget-settings';
import { useEnvironmentStore } from '@entities/environment/environment-context';
import { useSessionStore } from '@entities/session/session-context';
import { useUnitsStore } from '@entities/app-settings/units-context';

import styles from './WeatherHeader.module.scss';

const ICON_MAP = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  'cloud-rain': CloudRain,
};

const ICON_SIZE_PX = 20;

export const WeatherHeader = observer(() => {
  const units = useUnitsStore();

  const settings = useWidgetSettings<WeatherWidgetSettings>('weather');
  const { showAirTemp, showCompass } = settings;

  const { sessionInfo } = useSessionStore();
  const { environment } = useEnvironmentStore();

  const { unitSystem } = units;
  const tUnit = tempUnit(unitSystem);

  const airTempC =
    environment?.airTemp ?? parseWeekendFloat(sessionInfo?.trackAirTemp);
  const skies = environment?.skies;
  const wetness = environment?.trackWetness;

  const iconName = getWeatherIcon(skies, wetness);
  const WeatherIcon = ICON_MAP[iconName] ?? Sun;

  const skiesLabel = getSkiesLabel(skies);

  return (
    <div className={`${styles.header} ${showCompass ? styles.hasCompass : ''}`}>
      <div className={styles.conditionSection}>
        <div className={styles.iconWrapper}>
          <WeatherIcon size={ICON_SIZE_PX} className={styles.icon} />
        </div>
        <span className={styles.conditionText}>{skiesLabel}</span>
      </div>

      {showAirTemp && airTempC != null && (
        <span className={styles.airTempValue}>
          {Math.round(convertTemp(airTempC, unitSystem))}
          <span className={styles.unit}>{tUnit}</span>
        </span>
      )}
    </div>
  );
});
