import { observer } from 'mobx-react-lite';
import { Droplets, Thermometer, Waves, Wind } from 'lucide-react';

import {
  formatTemp,
  formatSpeed as _formatSpeed,
  speedUnit as _speedUnit,
  tempUnit,
} from '@utils/formatters/telemetry-format';
import {
  HUMIDITY_COLOR,
  airTempFraction,
  bearingToCardinal,
  getTrackWetnessInfo,
  getWindColor,
  humidityFraction,
  parseWeekendFloat,
  radsToBearing,
  trackTempFraction,
  wetnessFraction,
  windFraction,
} from '@utils/widget/weather-utils';
import { getAirTempColor, getTrackTempColor } from '@utils/widget/widget-utils';

import { WidgetValue } from '@/components/shared/WidgetValue/WidgetValue';
import { WidgetLabel } from '@/components/shared/WidgetLabel/WidgetLabel';
import styles from './StatCell.module.scss';
import type { WeatherWidgetSettings } from '@/types/widget-settings';
import {
  useEnvironmentStore,
  useSessionStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export type StatCellType =
  | 'airTemp'
  | 'trackTemp'
  | 'wind'
  | 'humidity'
  | 'trackWetness';

const STAT_CELL_SETTING_KEY: Record<
  StatCellType,
  | 'showAirTemp'
  | 'showTrackTemp'
  | 'showWind'
  | 'showHumidity'
  | 'showTrackWetness'
> = {
  airTemp: 'showAirTemp',
  trackTemp: 'showTrackTemp',
  wind: 'showWind',
  humidity: 'showHumidity',
  trackWetness: 'showTrackWetness',
};

const STAT_CELL_ICON = {
  airTemp: Thermometer,
  trackTemp: Thermometer,
  wind: Wind,
  humidity: Droplets,
  trackWetness: Waves,
};

const ICON_SIZE_PX = 11;

interface StatCellProps {
  type: StatCellType;
}

export const StatCell = observer(({ type }: StatCellProps) => {
  const { sessionInfo } = useSessionStore();
  const { environment: env } = useEnvironmentStore();
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settingKey = STAT_CELL_SETTING_KEY[type];
  const settings = widgetSettings.getSettings<WeatherWidgetSettings>('weather');

  if (!settings[settingKey]) {
    return null;
  }

  const { unitSystem } = units;

  let label = '';
  let value = '';
  let unit: string | undefined;
  let accentColor: string | undefined;
  let fillFraction = 0;

  if (type === 'airTemp') {
    const airTempC =
      env?.air_temp ?? parseWeekendFloat(sessionInfo?.trackAirTemp);

    label = 'AIR';
    value = formatTemp(airTempC, unitSystem);
    unit = tempUnit(unitSystem);
    fillFraction = airTempFraction(airTempC);

    if (airTempC !== null) {
      accentColor = getAirTempColor(airTempC);
    }
  } else if (type === 'trackTemp') {
    const trackTempC =
      env?.track_temp ?? parseWeekendFloat(sessionInfo?.trackSurfaceTemp);

    label = 'TRACK';
    value = formatTemp(trackTempC, unitSystem);
    unit = tempUnit(unitSystem);
    fillFraction = trackTempFraction(trackTempC);

    if (trackTempC !== null) {
      accentColor = getTrackTempColor(trackTempC);
    }
  } else if (type === 'wind') {
    const windVelMps =
      env?.wind_vel ?? parseWeekendFloat(sessionInfo?.trackWindVel);
    const windDirRad =
      env?.wind_dir ?? parseWeekendFloat(sessionInfo?.trackWindDir);

    label = 'WIND';

    if (windDirRad !== null) {
      const bearing = radsToBearing(windDirRad);

      label = settings.showWindBearing
        ? `WIND ${Math.round(bearing)}°`
        : `WIND ${bearingToCardinal(bearing)}`;
    }

    value = windVelMps !== null ? _formatSpeed(windVelMps, unitSystem) : '--.-';
    unit = _speedUnit(unitSystem);
    accentColor = getWindColor(windVelMps);
    fillFraction = windFraction(windVelMps);
  } else if (type === 'humidity') {
    const rawHumidity =
      env?.relative_humidity !== undefined && env?.relative_humidity !== null
        ? env.relative_humidity * 100
        : parseWeekendFloat(sessionInfo?.trackRelativeHumidity);

    label = 'HUMIDITY';
    value = rawHumidity !== null ? `${Math.round(rawHumidity)}` : '--';
    unit = '%';
    accentColor = HUMIDITY_COLOR;
    fillFraction = humidityFraction(rawHumidity);
  } else if (type === 'trackWetness') {
    const wetness = env?.track_wetness;
    const info = getTrackWetnessInfo(wetness);

    label = 'SURFACE';
    value = info?.label ?? '--';
    accentColor = info?.color;
    fillFraction = wetnessFraction(wetness);
  }

  const Icon = STAT_CELL_ICON[type];

  const isCompactValue = value.length > 5;

  return (
    <div className={styles.statCell}>
      <div className={styles.statTop}>
        <Icon
          size={ICON_SIZE_PX}
          className={styles.statIcon}
          style={accentColor !== undefined ? { color: accentColor } : undefined}
        />

        <WidgetLabel mono uppercase={false} className={styles.statLabel}>
          {label}
        </WidgetLabel>
      </div>

      <WidgetValue
        value={value}
        unit={unit}
        className={`${styles.statValue} ${isCompactValue ? styles.statValueCompact : ''}`}
        unitClassName={styles.statUnit}
      />

      <div className={styles.statBar}>
        <span
          className={styles.statBarFill}
          style={{
            width: `${fillFraction * 100}%`,
            background: accentColor,
          }}
        />
      </div>
    </div>
  );
});
