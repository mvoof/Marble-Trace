import { observer } from 'mobx-react-lite';

import {
  formatTemp,
  formatSpeed as _formatSpeed,
  speedUnit as _speedUnit,
  tempUnit,
} from '@utils/formatters/telemetry-format';
import {
  getWindColor,
  parseWeekendFloat,
  getTrackWetnessInfo,
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

const ACCENT_CLASS: Partial<Record<StatCellType, string>> = {
  trackTemp: styles.accentWarning,
};

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

  let customBorderColor: string | undefined;

  if (type === 'airTemp') {
    const airTempC =
      env?.air_temp ?? parseWeekendFloat(sessionInfo?.trackAirTemp);

    label = 'AIR';
    value = formatTemp(airTempC, unitSystem);
    unit = tempUnit(unitSystem);

    if (airTempC !== null) {
      customBorderColor = getAirTempColor(airTempC);
    }
  } else if (type === 'trackTemp') {
    const trackTempC =
      env?.track_temp ?? parseWeekendFloat(sessionInfo?.trackSurfaceTemp);

    label = 'TRK';
    value = formatTemp(trackTempC, unitSystem);
    unit = tempUnit(unitSystem);
    if (trackTempC !== null) {
      customBorderColor = getTrackTempColor(trackTempC);
    }
  } else if (type === 'wind') {
    const windVelMps =
      env?.wind_vel ?? parseWeekendFloat(sessionInfo?.trackWindVel);

    label = 'WIND';
    value = windVelMps !== null ? _formatSpeed(windVelMps, unitSystem) : '--.-';
    unit = _speedUnit(unitSystem);
    customBorderColor = getWindColor(windVelMps);
  } else if (type === 'humidity') {
    const rawHumidity =
      env?.relative_humidity !== undefined && env?.relative_humidity !== null
        ? env.relative_humidity * 100
        : parseWeekendFloat(sessionInfo?.trackRelativeHumidity);

    label = 'HUM.';
    value = rawHumidity !== null ? `${Math.round(rawHumidity)}%` : '--%';
  } else if (type === 'trackWetness') {
    const wetness = env?.track_wetness;
    const info = getTrackWetnessInfo(wetness);

    label = 'TRACK';
    value = info?.label ?? '--';
    customBorderColor = info?.color;
  }

  const accentClass = ACCENT_CLASS[type] ?? styles.accentNeutral;

  return (
    <div
      className={`${styles.statCell} ${accentClass}`}
      style={
        customBorderColor !== undefined
          ? { borderLeftColor: customBorderColor }
          : undefined
      }
    >
      <WidgetLabel mono uppercase={false} className={styles.statLabel}>
        {label}
      </WidgetLabel>

      <WidgetValue value={value} unit={unit} className={styles.statValue} />
    </div>
  );
});
