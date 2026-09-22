import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';
import { Droplets, Thermometer, Waves, Wind } from 'lucide-react';

import {
  formatTemp,
  formatSpeed as _formatSpeed,
  speedUnit as _speedUnit,
  tempUnit,
} from '@utils/telemetry-format';
import {
  HUMIDITY_COLOR,
  bearingToCardinal,
  getTrackWetnessInfo,
  getWindColor,
  parseWeekendFloat,
  radsToBearing,
} from '@utils/weather-utils';
import { getAirTempColor, getTrackTempColor } from '@utils/colors';

import { WidgetValue } from '@ui/shared/WidgetValue/WidgetValue';
import { WidgetLabel } from '@ui/shared/WidgetLabel/WidgetLabel';
import styles from './StatCell.module.scss';
import type { WeatherWidgetSettings } from '@/types/widget-settings';
import {
  useEnvironmentStore,
  useSessionStore,
  useUnitsStore,
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
const HORIZONTAL_ICON_SIZE_PX = 13;

interface StatCellProps {
  type: StatCellType;
  /** The horizontal layout gives the cell a full column, so it is set larger. */
  horizontal?: boolean;
}

export const StatCell = observer(
  ({ type, horizontal = false }: StatCellProps) => {
    const { sessionInfo } = useSessionStore();
    const { environment: env } = useEnvironmentStore();
    const units = useUnitsStore();

    const settingKey = STAT_CELL_SETTING_KEY[type];
    const settings = useWidgetSettings<WeatherWidgetSettings>('weather');

    if (!settings[settingKey]) {
      return null;
    }

    const { unitSystem } = units;

    let label = '';
    let value = '';
    let unit: string | undefined;
    let accentColor: string | undefined;

    if (type === 'airTemp') {
      const airTempC =
        env?.airTemp ?? parseWeekendFloat(sessionInfo?.trackAirTemp);

      label = 'AIR';
      value = formatTemp(airTempC, unitSystem);
      unit = tempUnit(unitSystem);

      if (airTempC !== null) {
        accentColor = getAirTempColor(airTempC);
      }
    } else if (type === 'trackTemp') {
      const trackTempC =
        env?.trackTemp ?? parseWeekendFloat(sessionInfo?.trackSurfaceTemp);

      label = 'TRACK';
      value = formatTemp(trackTempC, unitSystem);
      unit = tempUnit(unitSystem);

      if (trackTempC !== null) {
        accentColor = getTrackTempColor(trackTempC);
      }
    } else if (type === 'wind') {
      const windVelMps =
        env?.windVel ?? parseWeekendFloat(sessionInfo?.trackWindVel);
      const windDirRad =
        env?.windDir ?? parseWeekendFloat(sessionInfo?.trackWindDir);

      label = 'WIND';

      if (windDirRad !== null) {
        const bearing = radsToBearing(windDirRad);

        label = settings.showWindBearing
          ? `WIND ${Math.round(bearing)}°`
          : `WIND ${bearingToCardinal(bearing)}`;
      }

      value =
        windVelMps !== null ? _formatSpeed(windVelMps, unitSystem) : '--.-';
      unit = _speedUnit(unitSystem);
      accentColor = getWindColor(windVelMps);
    } else if (type === 'humidity') {
      const rawHumidity =
        env?.relativeHumidity !== undefined && env?.relativeHumidity !== null
          ? env.relativeHumidity * 100
          : parseWeekendFloat(sessionInfo?.trackRelativeHumidity);

      label = 'HUMIDITY';
      value = rawHumidity !== null ? `${Math.round(rawHumidity)}` : '--';
      unit = '%';
      accentColor = HUMIDITY_COLOR;
    } else if (type === 'trackWetness') {
      const wetness = env?.trackWetness;
      const info = getTrackWetnessInfo(wetness);

      label = 'SURFACE';
      value = info?.label ?? '--';
      accentColor = info?.color;
    }

    const Icon = STAT_CELL_ICON[type];

    const isCompactValue = value.length > 5;

    return (
      <div
        className={`${styles.statCell} ${horizontal ? styles.statCellHorizontal : ''}`}
      >
        <div className={styles.statTop}>
          <Icon
            size={horizontal ? HORIZONTAL_ICON_SIZE_PX : ICON_SIZE_PX}
            className={styles.statIcon}
            style={
              accentColor !== undefined ? { color: accentColor } : undefined
            }
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
      </div>
    );
  }
);
