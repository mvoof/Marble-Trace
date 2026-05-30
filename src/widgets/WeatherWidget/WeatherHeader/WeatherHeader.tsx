import { observer } from 'mobx-react-lite';
import { Sun, CloudSun, Cloud, CloudRain } from 'lucide-react';

import { convertTemp, tempUnit } from '@utils/formatters/telemetry-format';
import { parseWeekendFloat, getWeatherIcon } from '@utils/widget/weather-utils';
import type { WeatherWidgetSettings } from '@/types/widget-settings';
import {
  useTelemetryStore,
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

const ICON_COLOR = '#ffffff';

export const WeatherHeader = observer(() => {
  const telemetry = useTelemetryStore();
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<WeatherWidgetSettings>('weather');
  const { showAirTemp } = settings;

  if (!showAirTemp) {
    return null;
  }

  const { weekendInfo, environment } = telemetry;
  const { unitSystem } = units;
  const tUnit = tempUnit(unitSystem);

  const airTempC =
    environment?.air_temp ?? parseWeekendFloat(weekendInfo?.TrackAirTemp);
  const skies = environment?.skies;
  const wetness = environment?.track_wetness;

  const iconName = getWeatherIcon(skies, wetness);
  const WeatherIcon = ICON_MAP[iconName] ?? Sun;
  const iconColor = ICON_COLOR;

  return (
    <div className={styles.header}>
      <div className={styles.iconWrapper}>
        <WeatherIcon size={30} color={iconColor} className={styles.icon} />
      </div>

      {showAirTemp && airTempC !== null && (
        <div className={styles.airTemp}>
          <span className={styles.airTempValue}>
            {Math.round(convertTemp(airTempC, unitSystem))}
            <span className={styles.unit}>{tUnit}</span>
          </span>
        </div>
      )}
    </div>
  );
});
