import { observer } from 'mobx-react-lite';

import { telemetryStore } from '@store/iracing/telemetry.store';
import { unitsStore } from '@store/units.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import {
  formatTemp,
  formatSpeed as _formatSpeed,
  speedUnit as _speedUnit,
  tempUnit,
} from '@utils/formatters/telemetry-format';
import { parseWeekendFloat } from '@utils/widget/weather-utils';

import { UnitValueText } from '@/components/shared/primitives/UnitValueText/UnitValueText';
import { UnitLabelText } from '@/components/shared/primitives/UnitLabelText/UnitLabelText';
import styles from './StatCell.module.scss';

export type StatCellType = 'airTemp' | 'trackTemp' | 'wind' | 'humidity';

const getWindColor = (mps: number | null): string => {
  if (mps === null) return '#3399ff';
  if (mps > 8) return '#ef4444';
  if (mps > 4) return '#ffcc00';

  return '#3399ff';
};

const STAT_CELL_SETTING_KEY: Record<
  StatCellType,
  'showAirTemp' | 'showTrackTemp' | 'showWind' | 'showHumidity'
> = {
  airTemp: 'showAirTemp',
  trackTemp: 'showTrackTemp',
  wind: 'showWind',
  humidity: 'showHumidity',
};

interface StatCellProps {
  type: StatCellType;
}

export const StatCell = observer(({ type }: StatCellProps) => {
  const settingKey = STAT_CELL_SETTING_KEY[type];
  const settings = widgetSettingsStore.getWeatherSettings();

  if (!settings[settingKey]) {
    return null;
  }

  const weekendInfo = telemetryStore.weekendInfo;
  const env = telemetryStore.environment;
  const { system } = unitsStore;

  let label = '';
  let value = '';
  let unit: string | undefined;
  let color = '#fff';

  if (type === 'airTemp') {
    const airTempC =
      env?.air_temp ?? parseWeekendFloat(weekendInfo?.TrackAirTemp);

    label = 'AIR';
    value = formatTemp(airTempC, system);
    unit = tempUnit(system);
    color = '#fff';
  } else if (type === 'trackTemp') {
    const trackTempC =
      env?.track_temp ?? parseWeekendFloat(weekendInfo?.TrackSurfaceTemp);

    label = 'TRK';
    value = formatTemp(trackTempC, system);
    unit = tempUnit(system);
    color = '#fbbf24';
  } else if (type === 'wind') {
    const windVelMps =
      env?.wind_vel ?? parseWeekendFloat(weekendInfo?.TrackWindVel);

    label = 'WIND';
    value = windVelMps !== null ? _formatSpeed(windVelMps, system) : '--.-';
    unit = _speedUnit(system);
    color = getWindColor(windVelMps);
  } else if (type === 'humidity') {
    const rawHumidity =
      env?.relative_humidity !== undefined && env?.relative_humidity !== null
        ? env.relative_humidity * 100
        : parseWeekendFloat(weekendInfo?.TrackRelativeHumidity);

    label = 'HUM.';
    value = rawHumidity !== null ? `${Math.round(rawHumidity)}%` : '--%';
    color = '#fff';
  }

  return (
    <div className={styles.statCell} style={{ borderLeftColor: color }}>
      <UnitLabelText mono uppercase={false} className={styles.statLabel}>
        {label}
      </UnitLabelText>

      <UnitValueText value={value} unit={unit} className={styles.statValue} />
    </div>
  );
});
